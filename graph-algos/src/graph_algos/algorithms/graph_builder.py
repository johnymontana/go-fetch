"""Graph builder for converting Dgraph data to NetworkX graphs."""

from typing import List, Dict, Any, Optional
import networkx as nx
from loguru import logger


class GraphBuilder:
    """Builds NetworkX graphs from Dgraph data."""
    
    def __init__(self):
        """Initialize graph builder."""
        self.last_graph_size = 0
        self.last_build_time = None
    
    def build_graph(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        directed: bool = False,
        include_self_loops: bool = False,
        min_degree: int = 0
    ) -> nx.Graph:
        """Build NetworkX graph from nodes and edges data.
        
        Args:
            nodes: List of node dictionaries with 'uid', 'name', 'type', etc.
            edges: List of edge dictionaries with 'source', 'target', etc.
            directed: Whether to create a directed graph
            include_self_loops: Whether to include self-loops
            min_degree: Minimum degree for nodes to include
            
        Returns:
            NetworkX graph
        """
        import time
        start_time = time.time()
        
        # Create graph
        if directed:
            graph = nx.DiGraph()
        else:
            graph = nx.Graph()
        
        logger.info(f"Building graph from {len(nodes)} nodes and {len(edges)} edges")
        
        # Add nodes with attributes
        for node in nodes:
            node_id = node.get("uid") or node.get("node_id")
            if not node_id:
                continue
                
            graph.add_node(
                node_id,
                name=node.get("name", ""),
                type=node.get("type", ""),
                **{k: v for k, v in node.items() if k not in ["uid", "node_id", "name", "type"]}
            )
        
        # Add edges with attributes  
        edge_count = 0
        for edge in edges:
            source = edge.get("source")
            target = edge.get("target")
            
            if not source or not target:
                continue
                
            # Skip self-loops if not wanted
            if not include_self_loops and source == target:
                continue
            
            # Only add edges where both nodes exist
            if source in graph and target in graph:
                graph.add_edge(
                    source,
                    target,
                    relationship_type=edge.get("relationship_type", "related_to"),
                    **{k: v for k, v in edge.items() if k not in ["source", "target", "relationship_type"]}
                )
                edge_count += 1
        
        # Filter nodes by minimum degree
        if min_degree > 0:
            nodes_to_remove = [
                node for node, degree in graph.degree() if degree < min_degree
            ]
            graph.remove_nodes_from(nodes_to_remove)
            logger.info(f"Removed {len(nodes_to_remove)} nodes with degree < {min_degree}")
        
        # Record metrics
        self.last_graph_size = graph.number_of_nodes()
        self.last_build_time = time.time() - start_time
        
        logger.info(
            f"Built graph with {graph.number_of_nodes()} nodes and "
            f"{graph.number_of_edges()} edges in {self.last_build_time:.2f}s"
        )
        
        return graph
    
    def build_subgraph(
        self,
        graph: nx.Graph,
        node_filter: Optional[Dict[str, Any]] = None,
        edge_filter: Optional[Dict[str, Any]] = None,
        max_nodes: Optional[int] = None
    ) -> nx.Graph:
        """Build subgraph based on filters.
        
        Args:
            graph: Source graph
            node_filter: Node attribute filters (e.g., {"type": "PERSON"})
            edge_filter: Edge attribute filters
            max_nodes: Maximum number of nodes to include
            
        Returns:
            Filtered subgraph
        """
        nodes_to_include = set()
        
        # Filter nodes
        for node, attrs in graph.nodes(data=True):
            if node_filter:
                if all(attrs.get(k) == v for k, v in node_filter.items()):
                    nodes_to_include.add(node)
            else:
                nodes_to_include.add(node)
        
        # Limit nodes if specified
        if max_nodes and len(nodes_to_include) > max_nodes:
            nodes_to_include = set(list(nodes_to_include)[:max_nodes])
        
        # Create subgraph
        subgraph = graph.subgraph(nodes_to_include).copy()
        
        # Filter edges if needed
        if edge_filter:
            edges_to_remove = []
            for u, v, attrs in subgraph.edges(data=True):
                if not all(attrs.get(k) == v for k, v in edge_filter.items()):
                    edges_to_remove.append((u, v))
            subgraph.remove_edges_from(edges_to_remove)
        
        logger.info(
            f"Created subgraph with {subgraph.number_of_nodes()} nodes and "
            f"{subgraph.number_of_edges()} edges"
        )
        
        return subgraph
    
    def get_largest_component(self, graph: nx.Graph) -> nx.Graph:
        """Get the largest connected component.
        
        Args:
            graph: Input graph
            
        Returns:
            Largest connected component as a graph
        """
        if isinstance(graph, nx.DiGraph):
            components = nx.weakly_connected_components(graph)
        else:
            components = nx.connected_components(graph)
        
        largest_component = max(components, key=len)
        subgraph = graph.subgraph(largest_component).copy()
        
        logger.info(
            f"Largest component has {subgraph.number_of_nodes()} nodes and "
            f"{subgraph.number_of_edges()} edges"
        )
        
        return subgraph