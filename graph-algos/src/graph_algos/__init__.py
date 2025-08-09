"""
Graph Algorithms Service for Dgraph

A comprehensive service for computing graph algorithms on Dgraph data using NetworkX
and writing results back to Dgraph. Supports community detection, centrality measures,
and other graph analytics.
"""

__version__ = "0.1.0"
__author__ = "Graph Fetch Team"

from .core.config import Config
from .core.dgraph_client import DgraphClient
from .algorithms.centrality import CentralityAlgorithms
from .algorithms.community import CommunityDetection
from .api.server import GraphAlgoServer

__all__ = [
    "Config",
    "DgraphClient", 
    "CentralityAlgorithms",
    "CommunityDetection",
    "GraphAlgoServer",
]