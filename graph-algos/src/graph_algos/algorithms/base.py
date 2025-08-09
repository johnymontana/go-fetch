"""Base class for graph algorithms."""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import time
import networkx as nx
from loguru import logger


class BaseAlgorithm(ABC):
    """Base class for all graph algorithms."""
    
    def __init__(self, name: str, timeout: int = 300):
        """Initialize algorithm.
        
        Args:
            name: Algorithm name
            timeout: Algorithm timeout in seconds
        """
        self.name = name
        self.timeout = timeout
        self.last_run_time = None
        self.last_run_duration = None
        self.last_result_count = None
    
    @abstractmethod
    def compute(self, graph: nx.Graph, **kwargs) -> Dict[str, Any]:
        """Compute algorithm on graph.
        
        Args:
            graph: NetworkX graph
            **kwargs: Algorithm-specific parameters
            
        Returns:
            Dictionary mapping node IDs to computed values
        """
        pass
    
    def run(
        self,
        graph: nx.Graph,
        write_to_dgraph: bool = True,
        dgraph_client=None,
        create_community_nodes: bool = False,
        **kwargs
    ) -> Dict[str, Any]:
        """Run algorithm with timing and error handling.
        
        Args:
            graph: NetworkX graph
            write_to_dgraph: Whether to write results to Dgraph
            dgraph_client: Dgraph client instance
            create_community_nodes: Whether to create community nodes and edges
            **kwargs: Algorithm-specific parameters
            
        Returns:
            Algorithm results and metadata
        """
        start_time = time.time()
        self.last_run_time = start_time
        
        try:
            logger.info(f"Starting {self.name} algorithm on graph with {graph.number_of_nodes()} nodes")
            
            # Check graph size
            if graph.number_of_nodes() == 0:
                logger.warning(f"{self.name}: Empty graph provided")
                return {"results": {}, "metadata": {"error": "Empty graph"}}
            
            # Compute algorithm
            results = self.compute(graph, **kwargs)
            
            # Record metrics
            duration = time.time() - start_time
            self.last_run_duration = duration
            self.last_result_count = len(results)
            
            metadata = {
                "algorithm": self.name,
                "duration_seconds": duration,
                "result_count": len(results),
                "graph_nodes": graph.number_of_nodes(),
                "graph_edges": graph.number_of_edges(),
                "timestamp": time.time()
            }
            
            logger.info(
                f"{self.name} completed in {duration:.2f}s with {len(results)} results"
            )
            
            # Write to Dgraph if requested
            if write_to_dgraph and dgraph_client:
                success = dgraph_client.write_algorithm_results(
                    self.name,
                    results,
                    metadata
                )
                metadata["written_to_dgraph"] = success
                
                # Create community nodes if requested (for community detection algorithms)
                if create_community_nodes and results:
                    try:
                        community_uids = dgraph_client.create_community_nodes(
                            self.name,
                            results,
                            metadata
                        )
                        metadata["community_nodes_created"] = len(community_uids)
                        metadata["community_uids"] = community_uids
                        logger.info(f"Created {len(community_uids)} community nodes for {self.name}")
                    except Exception as e:
                        logger.error(f"Failed to create community nodes: {e}")
                        metadata["community_creation_error"] = str(e)
            
            return {
                "results": results,
                "metadata": metadata
            }
            
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"{self.name} failed after {duration:.2f}s: {e}")
            
            return {
                "results": {},
                "metadata": {
                    "algorithm": self.name,
                    "error": str(e),
                    "duration_seconds": duration,
                    "timestamp": time.time()
                }
            }
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get algorithm statistics.
        
        Returns:
            Dictionary with algorithm statistics
        """
        return {
            "name": self.name,
            "last_run_time": self.last_run_time,
            "last_run_duration": self.last_run_duration,
            "last_result_count": self.last_result_count,
            "timeout": self.timeout
        }