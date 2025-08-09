"""Dgraph client with connection string support."""

import re
from typing import Dict, Any, List, Optional, Tuple
from urllib.parse import urlparse, parse_qs
import pydgraph
from loguru import logger


class DgraphClient:
    """Dgraph client supporting dgraph:// connection strings."""
    
    def __init__(self, connection_string: str, timeout: int = 30):
        """Initialize Dgraph client.
        
        Args:
            connection_string: Dgraph connection string (dgraph://...)
            timeout: Query timeout in seconds
        """
        self.connection_string = connection_string
        self.timeout = timeout
        self._client_stub = None
        self._client = None
        self._parse_connection_string()
        self._connect()
    
    def _parse_connection_string(self) -> None:
        """Parse dgraph connection string into components."""
        if not self.connection_string.startswith("dgraph://"):
            raise ValueError("Connection string must start with 'dgraph://'")
        
        # Parse URL components
        parsed = urlparse(self.connection_string)
        
        self.host = parsed.hostname or "localhost"
        self.port = parsed.port or 9080
        
        # Extract authentication if present
        self.username = parsed.username
        self.password = parsed.password
        
        # Parse query parameters
        query_params = parse_qs(parsed.query)
        self.ssl_mode = query_params.get("sslmode", ["disable"])[0]
        self.bearer_token = query_params.get("bearertoken", [None])[0]
        
        logger.info(
            f"Parsed connection: host={self.host}, port={self.port}, "
            f"ssl_mode={self.ssl_mode}, has_bearer_token={bool(self.bearer_token)}"
        )
    
    def _connect(self) -> None:
        """Establish connection to Dgraph."""
        try:
            import grpc
            
            # Create client stub
            if self.ssl_mode in ["require", "verify-ca", "verify-full"]:
                # Use SSL credentials for cloud connections
                credentials = grpc.ssl_channel_credentials()
                self._client_stub = pydgraph.DgraphClientStub(
                    f"{self.host}:{self.port}",
                    credentials=credentials
                )
            else:
                # Use insecure connection for local development
                self._client_stub = pydgraph.DgraphClientStub(
                    f"{self.host}:{self.port}"
                )
            
            # Create client
            self._client = pydgraph.DgraphClient(self._client_stub)
            
            # Set authentication if provided
            if self.bearer_token:
                # For cloud Dgraph with bearer token, we need to add it to metadata
                # The token should be used in query calls directly
                logger.info("Using bearer token authentication")
            elif self.username and self.password:
                # For basic auth (local setup)
                logger.info("Using username/password authentication")
            
            logger.info(f"Connected to Dgraph at {self.host}:{self.port}")
            
        except Exception as e:
            logger.error(f"Failed to connect to Dgraph: {e}")
            raise
    
    def query(self, query: str, variables: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """Execute DQL query.
        
        Args:
            query: DQL query string
            variables: Optional query variables
            
        Returns:
            Query result as dictionary
        """
        if not self._client:
            raise RuntimeError("Not connected to Dgraph")
        
        try:
            logger.debug(f"Executing query: {query[:100]}...")
            
            # Create metadata for bearer token authentication
            metadata = None
            if self.bearer_token:
                metadata = [('authorization', f'Bearer {self.bearer_token}')]
            
            # Use transaction for queries with pydgraph
            txn = self._client.txn(read_only=True)
            try:
                if variables:
                    response = txn.query(query, variables=variables, metadata=metadata)
                else:
                    response = txn.query(query, metadata=metadata)
            finally:
                txn.discard()
            
            # Handle response - it may be bytes that need JSON parsing
            if hasattr(response, 'json'):
                if isinstance(response.json, bytes):
                    import json
                    return json.loads(response.json.decode('utf-8'))
                else:
                    return response.json
            else:
                # Fallback for older pydgraph versions
                import json
                return json.loads(str(response))
            
        except Exception as e:
            logger.error(f"Query failed: {e}")
            raise
    
    def mutate(self, mutation: Dict[str, Any], commit_now: bool = True) -> Dict[str, Any]:
        """Execute mutation.
        
        Args:
            mutation: Mutation data
            commit_now: Whether to commit immediately
            
        Returns:
            Mutation result
        """
        if not self._client:
            raise RuntimeError("Not connected to Dgraph")
        
        try:
            # Create metadata for bearer token authentication
            metadata = None
            if self.bearer_token:
                metadata = [('authorization', f'Bearer {self.bearer_token}')]
            
            txn = self._client.txn()
            
            try:
                response = txn.mutate(set_obj=mutation, commit_now=commit_now, metadata=metadata)
                logger.debug(f"Mutation completed with {len(response.uids)} UIDs")
                return {"uids": response.uids, "success": True}
                
            finally:
                if not commit_now:
                    txn.commit()
                txn.discard()
                
        except Exception as e:
            logger.error(f"Mutation failed: {e}")
            raise
    
    def get_graph_data(self, entity_type: str = "Entity", limit: int = 10000) -> Tuple[List[Dict], List[Dict]]:
        """Fetch graph data for algorithm processing.
        
        Args:
            entity_type: Type of entities to fetch
            limit: Maximum number of entities
            
        Returns:
            Tuple of (nodes, edges) as lists of dictionaries
        """
        query = f"""
        {{
          entities(func: type({entity_type}), first: {limit}) {{
            uid
            name
            type
            relatedTo @facets {{
              uid
              name
              type
            }}
          }}
        }}
        """
        
        result = self.query(query)
        entities = result.get("entities", []) if isinstance(result, dict) else []
        
        nodes = []
        edges = []
        
        for entity in entities:
            # Add node
            nodes.append({
                "uid": entity["uid"],
                "name": entity.get("name", ""),
                "type": entity.get("type", ""),
                "node_id": entity["uid"]
            })
            
            # Add edges
            for related in entity.get("relatedTo", []):
                edges.append({
                    "source": entity["uid"],
                    "target": related["uid"],
                    "relationship_type": related.get("relatedTo|type", "related_to")
                })
        
        logger.info(f"Fetched {len(nodes)} nodes and {len(edges)} edges")
        return nodes, edges
    
    def write_algorithm_results(
        self,
        algorithm_name: str,
        results: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Write algorithm results back to Dgraph.
        
        Args:
            algorithm_name: Name of the algorithm
            results: Algorithm results (node_id -> value mapping)
            metadata: Optional algorithm metadata
            
        Returns:
            Success status
        """
        try:
            mutations = []
            
            for node_id, value in results.items():
                mutation = {
                    "uid": node_id,
                    f"{algorithm_name}_score": value,
                }
                
                # Add metadata if provided
                if metadata:
                    for key, val in metadata.items():
                        mutation[f"{algorithm_name}_{key}"] = val
                
                mutations.append(mutation)
            
            # Batch mutations
            batch_size = 100
            for i in range(0, len(mutations), batch_size):
                batch = mutations[i:i + batch_size]
                self.mutate(batch)
            
            logger.info(
                f"Wrote {len(results)} {algorithm_name} results to Dgraph"
            )
            return True
            
        except Exception as e:
            logger.error(f"Failed to write {algorithm_name} results: {e}")
            return False
    
    def create_community_nodes(
        self,
        algorithm_name: str,
        communities: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, str]:
        """Create community nodes and connect them to member entities.
        
        Args:
            algorithm_name: Name of the algorithm (e.g., 'label_propagation')
            communities: Node ID -> community ID mapping
            metadata: Optional algorithm metadata
            
        Returns:
            Dictionary mapping community IDs to their UIDs
        """
        try:
            # Group entities by community
            community_members = {}
            for entity_uid, community_id in communities.items():
                if community_id not in community_members:
                    community_members[community_id] = []
                community_members[community_id].append(entity_uid)
            
            logger.info(f"Creating {len(community_members)} {algorithm_name} community nodes")
            
            # Create community nodes
            community_uids = {}
            
            for community_id, member_uids in community_members.items():
                # Create community node
                community_mutation = {
                    "dgraph.type": "Community",
                    "name": f"{algorithm_name}_community_{community_id}",
                    "algorithm": algorithm_name,
                    "community_id": community_id,
                    "member_count": len(member_uids),
                    "members": [{"uid": uid} for uid in member_uids]
                }
                
                # Add metadata if provided
                if metadata:
                    for key, val in metadata.items():
                        community_mutation[f"{algorithm_name}_{key}"] = val
                
                # Create the community node
                result = self.mutate([community_mutation])
                if result.get("success") and result.get("uids"):
                    # Get the newly created community UID
                    community_uid = list(result["uids"].values())[0]
                    community_uids[community_id] = community_uid
                    
                    logger.debug(f"Created community {community_id} with UID {community_uid} and {len(member_uids)} members")
            
            logger.info(f"Successfully created {len(community_uids)} community nodes")
            return community_uids
            
        except Exception as e:
            logger.error(f"Failed to create community nodes: {e}")
            raise

    def close(self) -> None:
        """Close Dgraph connection."""
        if self._client_stub:
            self._client_stub.close()
            logger.info("Dgraph connection closed")