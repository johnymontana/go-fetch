"""Centrality algorithms using NetworkX."""

from typing import Dict, Any, Optional, List
import networkx as nx
from loguru import logger
from .base import BaseAlgorithm


class PageRankAlgorithm(BaseAlgorithm):
    """PageRank centrality algorithm."""
    
    def __init__(self, timeout: int = 300):
        super().__init__("pagerank", timeout)
    
    def compute(self, graph: nx.Graph, **kwargs) -> Dict[str, Any]:
        """Compute PageRank centrality.
        
        Args:
            graph: NetworkX graph
            **kwargs: PageRank parameters (alpha, max_iter, tol)
            
        Returns:
            Dictionary mapping node IDs to PageRank scores
        """
        alpha = kwargs.get("alpha", 0.85)
        max_iter = kwargs.get("max_iter", 100)
        tol = kwargs.get("tol", 1e-06)
        
        logger.debug(f"Computing PageRank with alpha={alpha}, max_iter={max_iter}")
        
        try:
            scores = nx.pagerank(
                graph,
                alpha=alpha,
                max_iter=max_iter,
                tol=tol,
                weight=kwargs.get("weight")
            )
            return scores
        except nx.NetworkXError as e:
            logger.error(f"PageRank computation failed: {e}")
            return {}


class BetweennessCentralityAlgorithm(BaseAlgorithm):
    """Betweenness centrality algorithm."""
    
    def __init__(self, timeout: int = 300):
        super().__init__("betweenness_centrality", timeout)
    
    def compute(self, graph: nx.Graph, **kwargs) -> Dict[str, Any]:
        """Compute betweenness centrality.
        
        Args:
            graph: NetworkX graph
            **kwargs: Betweenness parameters (k, normalized, weight)
            
        Returns:
            Dictionary mapping node IDs to betweenness scores
        """
        k = kwargs.get("k")  # Number of nodes to sample
        normalized = kwargs.get("normalized", True)
        weight = kwargs.get("weight")
        
        logger.debug(f"Computing betweenness centrality with k={k}, normalized={normalized}")
        
        try:
            scores = nx.betweenness_centrality(
                graph,
                k=k,
                normalized=normalized,
                weight=weight
            )
            return scores
        except nx.NetworkXError as e:
            logger.error(f"Betweenness centrality computation failed: {e}")
            return {}


class ClosenessCentralityAlgorithm(BaseAlgorithm):
    """Closeness centrality algorithm."""
    
    def __init__(self, timeout: int = 300):
        super().__init__("closeness_centrality", timeout)
    
    def compute(self, graph: nx.Graph, **kwargs) -> Dict[str, Any]:
        """Compute closeness centrality.
        
        Args:
            graph: NetworkX graph
            **kwargs: Closeness parameters (distance, wf_improved)
            
        Returns:
            Dictionary mapping node IDs to closeness scores
        """
        distance = kwargs.get("distance")
        wf_improved = kwargs.get("wf_improved", True)
        
        logger.debug(f"Computing closeness centrality with wf_improved={wf_improved}")
        
        try:
            scores = nx.closeness_centrality(
                graph,
                distance=distance,
                wf_improved=wf_improved
            )
            return scores
        except nx.NetworkXError as e:
            logger.error(f"Closeness centrality computation failed: {e}")
            return {}


class EigenvectorCentralityAlgorithm(BaseAlgorithm):
    """Eigenvector centrality algorithm."""
    
    def __init__(self, timeout: int = 300):
        super().__init__("eigenvector_centrality", timeout)
    
    def compute(self, graph: nx.Graph, **kwargs) -> Dict[str, Any]:
        """Compute eigenvector centrality.
        
        Args:
            graph: NetworkX graph
            **kwargs: Eigenvector parameters (max_iter, tol, weight)
            
        Returns:
            Dictionary mapping node IDs to eigenvector scores
        """
        max_iter = kwargs.get("max_iter", 100)
        tol = kwargs.get("tol", 1e-06)
        weight = kwargs.get("weight")
        
        logger.debug(f"Computing eigenvector centrality with max_iter={max_iter}")
        
        try:
            scores = nx.eigenvector_centrality(
                graph,
                max_iter=max_iter,
                tol=tol,
                weight=weight
            )
            return scores
        except (nx.NetworkXError, nx.PowerIterationFailedConvergence) as e:
            logger.warning(f"Eigenvector centrality failed, trying with different params: {e}")
            # Try with different parameters
            try:
                scores = nx.eigenvector_centrality_numpy(graph, weight=weight)
                return scores
            except Exception as e2:
                logger.error(f"Eigenvector centrality computation failed: {e2}")
                return {}


class CentralityAlgorithms:
    """Collection of centrality algorithms."""
    
    def __init__(self, config=None):
        """Initialize centrality algorithms.
        
        Args:
            config: Configuration object with algorithm settings
        """
        self.config = config
        timeout = config.default_algorithm_timeout if config else 300
        
        # Initialize algorithms based on config
        self.algorithms = {}
        
        if not config or config.enable_pagerank:
            self.algorithms["pagerank"] = PageRankAlgorithm(timeout)
            
        if not config or config.enable_betweenness:
            self.algorithms["betweenness_centrality"] = BetweennessCentralityAlgorithm(timeout)
            
        if not config or config.enable_closeness:
            self.algorithms["closeness_centrality"] = ClosenessCentralityAlgorithm(timeout)
            
        if not config or config.enable_eigenvector:
            self.algorithms["eigenvector_centrality"] = EigenvectorCentralityAlgorithm(timeout)
    
    def run_all(
        self,
        graph: nx.Graph,
        write_to_dgraph: bool = True,
        dgraph_client=None,
        **kwargs
    ) -> Dict[str, Any]:
        """Run all enabled centrality algorithms.
        
        Args:
            graph: NetworkX graph
            write_to_dgraph: Whether to write results to Dgraph
            dgraph_client: Dgraph client instance
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
        **kwargs
    ) -> Dict[str, Any]:
        """Run specific centrality algorithm.
        
        Args:
            algorithm_name: Name of algorithm to run
            graph: NetworkX graph
            write_to_dgraph: Whether to write results to Dgraph
            dgraph_client: Dgraph client instance
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