"""Community detection algorithms using NetworkX."""

from typing import Dict, Any, List
import networkx as nx
from loguru import logger
from .base import BaseAlgorithm

# Import community detection algorithms
try:
    import networkx.algorithms.community as nx_comm
    HAS_COMMUNITY = True
except ImportError:
    HAS_COMMUNITY = False

try:
    # Try to import python-louvain for better Louvain implementation
    import community as community_louvain
    HAS_LOUVAIN = True
except ImportError:
    HAS_LOUVAIN = False


class LouvainAlgorithm(BaseAlgorithm):
    """Louvain community detection algorithm."""
    
    def __init__(self, timeout: int = 300):
        super().__init__("louvain", timeout)
    
    def compute(self, graph: nx.Graph, **kwargs) -> Dict[str, Any]:
        """Compute Louvain communities.
        
        Args:
            graph: NetworkX graph
            **kwargs: Louvain parameters (resolution, random_state)
            
        Returns:
            Dictionary mapping node IDs to community IDs
        """
        resolution = kwargs.get("resolution", 1.0)
        random_state = kwargs.get("random_state", None)
        
        logger.debug(f"Computing Louvain with resolution={resolution}")
        
        try:
            if HAS_LOUVAIN:
                # Use python-louvain library
                partition = community_louvain.best_partition(
                    graph,
                    resolution=resolution,
                    random_state=random_state
                )
                return partition
            elif HAS_COMMUNITY:
                # Use NetworkX implementation
                communities = nx_comm.louvain_communities(
                    graph,
                    resolution=resolution,
                    seed=random_state
                )
                # Convert to node -> community_id mapping
                partition = {}
                for i, community in enumerate(communities):
                    for node in community:
                        partition[node] = i
                return partition
            else:
                logger.error("No Louvain implementation available")
                return {}
                
        except Exception as e:
            logger.error(f"Louvain computation failed: {e}")
            return {}


class LabelPropagationAlgorithm(BaseAlgorithm):
    """Label propagation community detection algorithm."""
    
    def __init__(self, timeout: int = 300):
        super().__init__("label_propagation", timeout)
    
    def compute(self, graph: nx.Graph, **kwargs) -> Dict[str, Any]:
        """Compute label propagation communities.
        
        Args:
            graph: NetworkX graph
            **kwargs: Label propagation parameters (max_iter, seed)
            
        Returns:
            Dictionary mapping node IDs to community IDs
        """
        max_iter = kwargs.get("max_iter", 30)
        seed = kwargs.get("seed", None)
        
        logger.debug(f"Computing label propagation with max_iter={max_iter}")
        
        try:
            if not HAS_COMMUNITY:
                logger.error("NetworkX community algorithms not available")
                return {}
            
            communities = nx_comm.label_propagation_communities(graph)
            
            # Convert to node -> community_id mapping
            partition = {}
            for i, community in enumerate(communities):
                for node in community:
                    partition[node] = i
            
            return partition
            
        except Exception as e:
            logger.error(f"Label propagation computation failed: {e}")
            return {}


class LeidenAlgorithm(BaseAlgorithm):
    """Leiden community detection algorithm (if available)."""
    
    def __init__(self, timeout: int = 300):
        super().__init__("leiden", timeout)
    
    def compute(self, graph: nx.Graph, **kwargs) -> Dict[str, Any]:
        """Compute Leiden communities.
        
        Args:
            graph: NetworkX graph
            **kwargs: Leiden parameters (resolution, n_iterations)
            
        Returns:
            Dictionary mapping node IDs to community IDs
        """
        try:
            # Try to import leidenalg
            import leidenalg
            import igraph as ig
        except ImportError:
            logger.warning("leidenalg or igraph not available, using Louvain instead")
            # Fallback to Louvain
            louvain = LouvainAlgorithm()
            return louvain.compute(graph, **kwargs)
        
        resolution = kwargs.get("resolution", 1.0)
        n_iterations = kwargs.get("n_iterations", 2)
        
        logger.debug(f"Computing Leiden with resolution={resolution}")
        
        try:
            # Convert NetworkX graph to igraph
            edge_list = list(graph.edges())
            node_list = list(graph.nodes())
            
            # Create igraph from edge list
            ig_graph = ig.Graph()
            ig_graph.add_vertices(len(node_list))
            ig_graph.add_edges([(node_list.index(u), node_list.index(v)) for u, v in edge_list])
            
            # Run Leiden algorithm
            partition = leidenalg.find_partition(
                ig_graph,
                leidenalg.RBConfigurationVertexPartition,
                resolution_parameter=resolution,
                n_iterations=n_iterations
            )
            
            # Convert back to NetworkX node IDs
            result = {}
            for i, community_id in enumerate(partition.membership):
                result[node_list[i]] = community_id
            
            return result
            
        except Exception as e:
            logger.error(f"Leiden computation failed: {e}")
            return {}


class GreedyModularityAlgorithm(BaseAlgorithm):
    """Greedy modularity community detection algorithm."""
    
    def __init__(self, timeout: int = 300):
        super().__init__("greedy_modularity", timeout)
    
    def compute(self, graph: nx.Graph, **kwargs) -> Dict[str, Any]:
        """Compute greedy modularity communities.
        
        Args:
            graph: NetworkX graph
            **kwargs: Algorithm parameters (cutoff, best_n)
            
        Returns:
            Dictionary mapping node IDs to community IDs
        """
        cutoff = kwargs.get("cutoff", 1)
        best_n = kwargs.get("best_n", None)
        
        logger.debug(f"Computing greedy modularity with cutoff={cutoff}")
        
        try:
            if not HAS_COMMUNITY:
                logger.error("NetworkX community algorithms not available")
                return {}
            
            communities = nx_comm.greedy_modularity_communities(
                graph,
                cutoff=cutoff,
                best_n=best_n
            )
            
            # Convert to node -> community_id mapping
            partition = {}
            for i, community in enumerate(communities):
                for node in community:
                    partition[node] = i
            
            return partition
            
        except Exception as e:
            logger.error(f"Greedy modularity computation failed: {e}")
            return {}


class CommunityDetection:
    """Collection of community detection algorithms."""
    
    def __init__(self, config=None):
        """Initialize community detection algorithms.
        
        Args:
            config: Configuration object with algorithm settings
        """
        self.config = config
        timeout = config.default_algorithm_timeout if config else 300
        
        # Initialize algorithms based on config
        self.algorithms = {}
        
        if not config or config.enable_louvain:
            self.algorithms["louvain"] = LouvainAlgorithm(timeout)
            
        if not config or config.enable_label_propagation:
            self.algorithms["label_propagation"] = LabelPropagationAlgorithm(timeout)
            
        if not config or config.enable_leiden:
            self.algorithms["leiden"] = LeidenAlgorithm(timeout)
        
        # Always include greedy modularity as fallback
        self.algorithms["greedy_modularity"] = GreedyModularityAlgorithm(timeout)
    
    def run_all(
        self,
        graph: nx.Graph,
        write_to_dgraph: bool = True,
        dgraph_client=None,
        create_community_nodes: bool = False,
        **kwargs
    ) -> Dict[str, Any]:
        """Run all enabled community detection algorithms.
        
        Args:
            graph: NetworkX graph
            write_to_dgraph: Whether to write results to Dgraph
            dgraph_client: Dgraph client instance
            create_community_nodes: Whether to create community nodes
            **kwargs: Algorithm parameters
            
        Returns:
            Dictionary with all algorithm results
        """
        results = {}
        
        for name, algorithm in self.algorithms.items():
            logger.info(f"Running {name} algorithm")
            result = algorithm.run(
                graph,
                write_to_dgraph=write_to_dgraph,
                dgraph_client=dgraph_client,
                create_community_nodes=create_community_nodes,
                **kwargs.get(name, {})
            )
            results[name] = result
        
        return results
    
    def run_algorithm(
        self,
        algorithm_name: str,
        graph: nx.Graph,
        write_to_dgraph: bool = True,
        dgraph_client=None,
        create_community_nodes: bool = False,
        **kwargs
    ) -> Dict[str, Any]:
        """Run specific community detection algorithm.
        
        Args:
            algorithm_name: Name of algorithm to run
            graph: NetworkX graph
            write_to_dgraph: Whether to write results to Dgraph
            dgraph_client: Dgraph client instance
            create_community_nodes: Whether to create community nodes
            **kwargs: Algorithm parameters
            
        Returns:
            Algorithm results
        """
        if algorithm_name not in self.algorithms:
            raise ValueError(f"Algorithm {algorithm_name} not available")
        
        algorithm = self.algorithms[algorithm_name]
        return algorithm.run(
            graph,
            write_to_dgraph=write_to_dgraph,
            dgraph_client=dgraph_client,
            create_community_nodes=create_community_nodes,
            **kwargs
        )
    
    def get_available_algorithms(self) -> List[str]:
        """Get list of available algorithms.
        
        Returns:
            List of algorithm names
        """
        return list(self.algorithms.keys())
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get statistics for all algorithms.
        
        Returns:
            Dictionary with algorithm statistics
        """
        return {
            name: algo.get_statistics() 
            for name, algo in self.algorithms.items()
        }
    
    def analyze_communities(self, graph: nx.Graph, partition: Dict[str, int]) -> Dict[str, Any]:
        """Analyze community structure.
        
        Args:
            graph: NetworkX graph
            partition: Node -> community mapping
            
        Returns:
            Community analysis results
        """
        if not partition:
            return {"error": "No partition provided"}
        
        try:
            # Basic statistics
            num_communities = len(set(partition.values()))
            community_sizes = {}
            for node, comm in partition.items():
                community_sizes[comm] = community_sizes.get(comm, 0) + 1
            
            # Modularity score
            try:
                # Convert partition to list of sets for modularity calculation
                communities = {}
                for node, comm in partition.items():
                    if comm not in communities:
                        communities[comm] = set()
                    communities[comm].add(node)
                
                community_list = list(communities.values())
                modularity = nx_comm.modularity(graph, community_list)
            except Exception as e:
                logger.warning(f"Could not calculate modularity: {e}")
                modularity = None
            
            return {
                "num_communities": num_communities,
                "community_sizes": community_sizes,
                "largest_community_size": max(community_sizes.values()) if community_sizes else 0,
                "smallest_community_size": min(community_sizes.values()) if community_sizes else 0,
                "average_community_size": sum(community_sizes.values()) / len(community_sizes) if community_sizes else 0,
                "modularity": modularity
            }
            
        except Exception as e:
            logger.error(f"Community analysis failed: {e}")
            return {"error": str(e)}