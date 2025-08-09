"""Flask API server for graph algorithms service."""

from typing import Dict, Any, Optional
import traceback
from flask import Flask, request, jsonify
from loguru import logger

from ..core.config import Config
from ..core.dgraph_client import DgraphClient
from ..algorithms.graph_builder import GraphBuilder
from ..algorithms.centrality import CentralityAlgorithms
from ..algorithms.community import CommunityDetection


class GraphAlgoServer:
    """Flask server for graph algorithms API."""
    
    def __init__(self, config: Optional[Config] = None):
        """Initialize server.
        
        Args:
            config: Configuration object
        """
        self.config = config or Config()
        self.app = Flask(__name__)
        self.dgraph_client = None
        self.graph_builder = GraphBuilder()
        self.centrality_algorithms = CentralityAlgorithms(self.config)
        self.community_algorithms = CommunityDetection(self.config)
        
        self._setup_routes()
        self._setup_error_handlers()
    
    def _setup_routes(self) -> None:
        """Setup Flask routes."""
        
        @self.app.route("/", methods=["GET"])
        def index():
            """Health check endpoint."""
            return jsonify({
                "service": "graph-algorithms",
                "status": "running",
                "version": "0.1.0",
                "algorithms": {
                    "centrality": self.centrality_algorithms.get_available_algorithms(),
                    "community": self.community_algorithms.get_available_algorithms()
                }
            })
        
        @self.app.route("/health", methods=["GET"])
        def health():
            """Detailed health check."""
            try:
                # Test Dgraph connection
                dgraph_status = "disconnected"
                if self.dgraph_client:
                    try:
                        self.dgraph_client.query("{ q(func: uid(0x1)) { uid } }")
                        dgraph_status = "connected"
                    except Exception:
                        dgraph_status = "error"
                
                return jsonify({
                    "status": "healthy",
                    "dgraph": dgraph_status,
                    "config": {
                        "dgraph_connection": self.config.dgraph_connection_string,
                        "enabled_algorithms": self.config.get_enabled_algorithms()
                    }
                })
            except Exception as e:
                return jsonify({"status": "unhealthy", "error": str(e)}), 500
        
        @self.app.route("/algorithms", methods=["GET"])
        def list_algorithms():
            """List available algorithms."""
            return jsonify({
                "centrality": {
                    "algorithms": self.centrality_algorithms.get_available_algorithms(),
                    "statistics": self.centrality_algorithms.get_statistics()
                },
                "community": {
                    "algorithms": self.community_algorithms.get_available_algorithms(), 
                    "statistics": self.community_algorithms.get_statistics()
                }
            })
        
        @self.app.route("/centrality/run", methods=["POST"])
        def run_centrality():
            """Run centrality algorithms."""
            try:
                data = request.get_json() or {}
                algorithm = data.get("algorithm", "all")
                params = data.get("parameters", {})
                write_to_dgraph = data.get("write_to_dgraph", True)
                graph_params = data.get("graph_parameters", {})
                
                # Connect to Dgraph
                if not self.dgraph_client:
                    self._connect_dgraph()
                
                # Build graph
                graph = self._build_graph(**graph_params)
                if graph.number_of_nodes() == 0:
                    return jsonify({"error": "Empty graph"}), 400
                
                # Run algorithms
                if algorithm == "all":
                    results = self.centrality_algorithms.run_all(
                        graph,
                        write_to_dgraph=write_to_dgraph,
                        dgraph_client=self.dgraph_client,
                        **params
                    )
                else:
                    results = {
                        algorithm: self.centrality_algorithms.run_algorithm(
                            algorithm,
                            graph,
                            write_to_dgraph=write_to_dgraph,
                            dgraph_client=self.dgraph_client,
                            **params.get(algorithm, {})
                        )
                    }
                
                return jsonify({
                    "success": True,
                    "results": results,
                    "graph_info": {
                        "nodes": graph.number_of_nodes(),
                        "edges": graph.number_of_edges()
                    }
                })
                
            except Exception as e:
                logger.error(f"Centrality computation failed: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e),
                    "traceback": traceback.format_exc()
                }), 500
        
        @self.app.route("/community/run", methods=["POST"])
        def run_community():
            """Run community detection algorithms."""
            try:
                data = request.get_json() or {}
                algorithm = data.get("algorithm", "all")
                params = data.get("parameters", {})
                write_to_dgraph = data.get("write_to_dgraph", True)
                graph_params = data.get("graph_parameters", {})
                analyze_communities = data.get("analyze_communities", True)
                
                # Connect to Dgraph
                if not self.dgraph_client:
                    self._connect_dgraph()
                
                # Build graph
                graph = self._build_graph(**graph_params)
                if graph.number_of_nodes() == 0:
                    return jsonify({"error": "Empty graph"}), 400
                
                # Run algorithms
                if algorithm == "all":
                    results = self.community_algorithms.run_all(
                        graph,
                        write_to_dgraph=write_to_dgraph,
                        dgraph_client=self.dgraph_client,
                        **params
                    )
                else:
                    results = {
                        algorithm: self.community_algorithms.run_algorithm(
                            algorithm,
                            graph,
                            write_to_dgraph=write_to_dgraph,
                            dgraph_client=self.dgraph_client,
                            **params.get(algorithm, {})
                        )
                    }
                
                # Add community analysis if requested
                if analyze_communities:
                    for alg_name, result in results.items():
                        if "results" in result and result["results"]:
                            analysis = self.community_algorithms.analyze_communities(
                                graph,
                                result["results"]
                            )
                            result["analysis"] = analysis
                
                return jsonify({
                    "success": True,
                    "results": results,
                    "graph_info": {
                        "nodes": graph.number_of_nodes(),
                        "edges": graph.number_of_edges()
                    }
                })
                
            except Exception as e:
                logger.error(f"Community detection failed: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e),
                    "traceback": traceback.format_exc()
                }), 500
        
        @self.app.route("/graph/info", methods=["GET", "POST"])
        def graph_info():
            """Get information about the graph."""
            try:
                if request.method == "POST":
                    graph_params = request.get_json() or {}
                else:
                    graph_params = {}
                
                # Connect to Dgraph
                if not self.dgraph_client:
                    self._connect_dgraph()
                
                # Build graph
                graph = self._build_graph(**graph_params)
                
                # Calculate basic statistics
                num_nodes = graph.number_of_nodes()
                num_edges = graph.number_of_edges()
                
                # Get degree statistics
                degrees = dict(graph.degree())
                if degrees:
                    avg_degree = sum(degrees.values()) / len(degrees)
                    max_degree = max(degrees.values())
                    min_degree = min(degrees.values())
                else:
                    avg_degree = max_degree = min_degree = 0
                
                # Check connectivity
                is_connected = len(list(graph.nodes())) > 0 and (
                    nx.is_connected(graph) if not isinstance(graph, nx.DiGraph) 
                    else nx.is_weakly_connected(graph)
                )
                
                return jsonify({
                    "nodes": num_nodes,
                    "edges": num_edges,
                    "density": nx.density(graph) if num_nodes > 0 else 0,
                    "is_connected": is_connected,
                    "degree_stats": {
                        "average": avg_degree,
                        "maximum": max_degree,
                        "minimum": min_degree
                    },
                    "node_types": self._get_node_type_counts(graph),
                    "edge_types": self._get_edge_type_counts(graph)
                })
                
            except Exception as e:
                logger.error(f"Graph info failed: {e}")
                return jsonify({
                    "error": str(e),
                    "traceback": traceback.format_exc()
                }), 500
        
        @self.app.route("/algorithms/run", methods=["POST"])
        def run_all_algorithms():
            """Run all enabled algorithms."""
            try:
                data = request.get_json() or {}
                params = data.get("parameters", {})
                write_to_dgraph = data.get("write_to_dgraph", True)
                graph_params = data.get("graph_parameters", {})
                
                # Connect to Dgraph
                if not self.dgraph_client:
                    self._connect_dgraph()
                
                # Build graph
                graph = self._build_graph(**graph_params)
                if graph.number_of_nodes() == 0:
                    return jsonify({"error": "Empty graph"}), 400
                
                results = {}
                
                # Run centrality algorithms
                centrality_results = self.centrality_algorithms.run_all(
                    graph,
                    write_to_dgraph=write_to_dgraph,
                    dgraph_client=self.dgraph_client,
                    **params.get("centrality", {})
                )
                results["centrality"] = centrality_results
                
                # Run community detection algorithms
                community_results = self.community_algorithms.run_all(
                    graph,
                    write_to_dgraph=write_to_dgraph,
                    dgraph_client=self.dgraph_client,
                    **params.get("community", {})
                )
                results["community"] = community_results
                
                return jsonify({
                    "success": True,
                    "results": results,
                    "graph_info": {
                        "nodes": graph.number_of_nodes(),
                        "edges": graph.number_of_edges()
                    }
                })
                
            except Exception as e:
                logger.error(f"All algorithms failed: {e}")
                return jsonify({
                    "success": False,
                    "error": str(e),
                    "traceback": traceback.format_exc()
                }), 500
    
    def _setup_error_handlers(self) -> None:
        """Setup Flask error handlers."""
        
        @self.app.errorhandler(404)
        def not_found(error):
            return jsonify({"error": "Endpoint not found"}), 404
        
        @self.app.errorhandler(500)
        def internal_error(error):
            return jsonify({"error": "Internal server error"}), 500
    
    def _connect_dgraph(self) -> None:
        """Connect to Dgraph."""
        if not self.dgraph_client:
            self.dgraph_client = DgraphClient(
                self.config.dgraph_connection_string,
                self.config.dgraph_timeout
            )
            logger.info("Connected to Dgraph")
    
    def _build_graph(self, **kwargs) -> "nx.Graph":
        """Build graph from Dgraph data.
        
        Args:
            **kwargs: Graph building parameters
            
        Returns:
            NetworkX graph
        """
        entity_type = kwargs.get("entity_type", "Entity")
        limit = kwargs.get("limit", self.config.max_graph_size)
        directed = kwargs.get("directed", False)
        include_self_loops = kwargs.get("include_self_loops", False)
        min_degree = kwargs.get("min_degree", 0)
        
        # Get data from Dgraph
        nodes, edges = self.dgraph_client.get_graph_data(entity_type, limit)
        
        # Build graph
        graph = self.graph_builder.build_graph(
            nodes,
            edges,
            directed=directed,
            include_self_loops=include_self_loops,
            min_degree=min_degree
        )
        
        # Get largest component if requested
        if kwargs.get("largest_component", False) and graph.number_of_nodes() > 0:
            graph = self.graph_builder.get_largest_component(graph)
        
        return graph
    
    def _get_node_type_counts(self, graph: "nx.Graph") -> Dict[str, int]:
        """Get count of nodes by type."""
        type_counts = {}
        for _, attrs in graph.nodes(data=True):
            node_type = attrs.get("type", "unknown")
            type_counts[node_type] = type_counts.get(node_type, 0) + 1
        return type_counts
    
    def _get_edge_type_counts(self, graph: "nx.Graph") -> Dict[str, int]:
        """Get count of edges by type."""
        type_counts = {}
        for _, _, attrs in graph.edges(data=True):
            edge_type = attrs.get("relationship_type", "unknown")
            type_counts[edge_type] = type_counts.get(edge_type, 0) + 1
        return type_counts
    
    def run(self, host: str = None, port: int = None, debug: bool = None) -> None:
        """Run the Flask server.
        
        Args:
            host: Server host
            port: Server port
            debug: Debug mode
        """
        host = host or self.config.flask_host
        port = port or self.config.flask_port
        debug = debug if debug is not None else self.config.flask_debug
        
        logger.info(f"Starting graph algorithms server on {host}:{port}")
        self.app.run(host=host, port=port, debug=debug)
    
    def get_app(self) -> Flask:
        """Get Flask app instance.
        
        Returns:
            Flask application
        """
        return self.app