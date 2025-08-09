"""Command-line interface for graph algorithms service."""

import click
import sys
from typing import Optional
from loguru import logger

from .core.config import Config
from .core.logger import setup_logger
from .core.dgraph_client import DgraphClient
from .api.server import GraphAlgoServer
from .algorithms.graph_builder import GraphBuilder
from .algorithms.centrality import CentralityAlgorithms
from .algorithms.community import CommunityDetection
from .schedulers.periodic_runner import PeriodicRunner


@click.group()
@click.option("--config", type=click.Path(exists=True), help="Configuration file path")
@click.option("--log-level", default="INFO", help="Log level")
@click.option("--log-format", default="text", help="Log format (text|json)")
@click.pass_context
def cli(ctx, config, log_level, log_format):
    """Graph algorithms service for Dgraph."""
    ctx.ensure_object(dict)
    
    # Setup logging
    setup_logger(log_level, log_format)
    
    # Load configuration
    if config:
        ctx.obj["config_path"] = config
        # Load from file - this would require additional implementation
        ctx.obj["config"] = Config()
    else:
        ctx.obj["config"] = Config()
    
    logger.info("Graph algorithms service initialized")


@cli.command()
@click.option("--host", default=None, help="Server host")
@click.option("--port", default=None, type=int, help="Server port")
@click.option("--debug", is_flag=True, help="Enable debug mode")
@click.pass_context
def server(ctx, host, port, debug):
    """Start the Flask API server."""
    config = ctx.obj["config"]
    
    try:
        server = GraphAlgoServer(config)
        server.run(host=host, port=port, debug=debug)
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server failed to start: {e}")
        sys.exit(1)


@cli.command()
@click.option("--algorithm", help="Specific algorithm to run (default: all)")
@click.option("--write/--no-write", default=True, help="Write results to Dgraph")
@click.option("--entity-type", default="Entity", help="Entity type to process")
@click.option("--limit", default=10000, type=int, help="Maximum entities to process")
@click.pass_context
def centrality(ctx, algorithm, write, entity_type, limit):
    """Run centrality algorithms."""
    config = ctx.obj["config"]
    
    try:
        # Connect to Dgraph
        client = DgraphClient(config.dgraph_connection_string, config.dgraph_timeout)
        
        # Build graph
        builder = GraphBuilder()
        nodes, edges = client.get_graph_data(entity_type, limit)
        graph = builder.build_graph(nodes, edges)
        
        if graph.number_of_nodes() == 0:
            logger.error("No graph data found")
            return
        
        logger.info(f"Built graph with {graph.number_of_nodes()} nodes and {graph.number_of_edges()} edges")
        
        # Run algorithms
        algorithms = CentralityAlgorithms(config)
        
        if algorithm:
            if algorithm not in algorithms.get_available_algorithms():
                logger.error(f"Algorithm '{algorithm}' not available")
                logger.info(f"Available algorithms: {algorithms.get_available_algorithms()}")
                return
            
            result = algorithms.run_algorithm(
                algorithm, graph, write_to_dgraph=write, dgraph_client=client
            )
            logger.info(f"Completed {algorithm}: {len(result.get('results', {}))} results")
        else:
            results = algorithms.run_all(
                graph, write_to_dgraph=write, dgraph_client=client
            )
            for alg_name, result in results.items():
                logger.info(f"Completed {alg_name}: {len(result.get('results', {}))} results")
    
    except Exception as e:
        logger.error(f"Centrality computation failed: {e}")
        sys.exit(1)
    finally:
        if "client" in locals():
            client.close()


@cli.command()
@click.option("--algorithm", help="Specific algorithm to run (default: all)")
@click.option("--write/--no-write", default=True, help="Write results to Dgraph")
@click.option("--create-communities/--no-create-communities", default=False, help="Create community nodes and edges")
@click.option("--entity-type", default="Entity", help="Entity type to process")
@click.option("--limit", default=10000, type=int, help="Maximum entities to process")
@click.pass_context
def community(ctx, algorithm, write, create_communities, entity_type, limit):
    """Run community detection algorithms."""
    config = ctx.obj["config"]
    
    try:
        # Connect to Dgraph
        client = DgraphClient(config.dgraph_connection_string, config.dgraph_timeout)
        
        # Build graph
        builder = GraphBuilder()
        nodes, edges = client.get_graph_data(entity_type, limit)
        graph = builder.build_graph(nodes, edges)
        
        if graph.number_of_nodes() == 0:
            logger.error("No graph data found")
            return
        
        logger.info(f"Built graph with {graph.number_of_nodes()} nodes and {graph.number_of_edges()} edges")
        
        # Run algorithms
        algorithms = CommunityDetection(config)
        
        if algorithm:
            if algorithm not in algorithms.get_available_algorithms():
                logger.error(f"Algorithm '{algorithm}' not available")
                logger.info(f"Available algorithms: {algorithms.get_available_algorithms()}")
                return
            
            result = algorithms.run_algorithm(
                algorithm, graph, write_to_dgraph=write, dgraph_client=client, create_community_nodes=create_communities
            )
            logger.info(f"Completed {algorithm}: {len(result.get('results', {}))} results")
            
            # Analyze communities
            if result.get("results"):
                analysis = algorithms.analyze_communities(graph, result["results"])
                logger.info(f"Community analysis: {analysis}")
        else:
            results = algorithms.run_all(
                graph, write_to_dgraph=write, dgraph_client=client, create_community_nodes=create_communities
            )
            for alg_name, result in results.items():
                logger.info(f"Completed {alg_name}: {len(result.get('results', {}))} results")
                
                # Analyze communities
                if result.get("results"):
                    analysis = algorithms.analyze_communities(graph, result["results"])
                    logger.info(f"{alg_name} analysis: {analysis}")
    
    except Exception as e:
        logger.error(f"Community detection failed: {e}")
        sys.exit(1)
    finally:
        if "client" in locals():
            client.close()


@cli.command()
@click.option("--write/--no-write", default=True, help="Write results to Dgraph")
@click.option("--entity-type", default="Entity", help="Entity type to process")
@click.option("--limit", default=10000, type=int, help="Maximum entities to process")
@click.pass_context
def run_all(ctx, write, entity_type, limit):
    """Run all enabled algorithms."""
    config = ctx.obj["config"]
    
    try:
        # Connect to Dgraph
        client = DgraphClient(config.dgraph_connection_string, config.dgraph_timeout)
        
        # Build graph
        builder = GraphBuilder()
        nodes, edges = client.get_graph_data(entity_type, limit)
        graph = builder.build_graph(nodes, edges)
        
        if graph.number_of_nodes() == 0:
            logger.error("No graph data found")
            return
        
        logger.info(f"Built graph with {graph.number_of_nodes()} nodes and {graph.number_of_edges()} edges")
        
        # Run centrality algorithms
        logger.info("Running centrality algorithms...")
        centrality_algs = CentralityAlgorithms(config)
        centrality_results = centrality_algs.run_all(
            graph, write_to_dgraph=write, dgraph_client=client
        )
        
        for alg_name, result in centrality_results.items():
            logger.info(f"Completed {alg_name}: {len(result.get('results', {}))} results")
        
        # Run community detection algorithms
        logger.info("Running community detection algorithms...")
        community_algs = CommunityDetection(config)
        community_results = community_algs.run_all(
            graph, write_to_dgraph=write, dgraph_client=client
        )
        
        for alg_name, result in community_results.items():
            logger.info(f"Completed {alg_name}: {len(result.get('results', {}))} results")
            
            # Analyze communities
            if result.get("results"):
                analysis = community_algs.analyze_communities(graph, result["results"])
                logger.info(f"{alg_name} analysis: {analysis}")
        
        logger.info("All algorithms completed successfully")
    
    except Exception as e:
        logger.error(f"Algorithm execution failed: {e}")
        sys.exit(1)
    finally:
        if "client" in locals():
            client.close()


@cli.command()
@click.option("--entity-type", default="Entity", help="Entity type to analyze")
@click.option("--limit", default=10000, type=int, help="Maximum entities to process")
@click.pass_context
def graph_info(ctx, entity_type, limit):
    """Display graph information."""
    config = ctx.obj["config"]
    
    try:
        # Connect to Dgraph
        client = DgraphClient(config.dgraph_connection_string, config.dgraph_timeout)
        
        # Build graph
        builder = GraphBuilder()
        nodes, edges = client.get_graph_data(entity_type, limit)
        graph = builder.build_graph(nodes, edges)
        
        # Display information
        print(f"\nGraph Information:")
        print(f"  Nodes: {graph.number_of_nodes()}")
        print(f"  Edges: {graph.number_of_edges()}")
        
        if graph.number_of_nodes() > 0:
            import networkx as nx
            print(f"  Density: {nx.density(graph):.4f}")
            
            # Degree statistics
            degrees = dict(graph.degree())
            if degrees:
                avg_degree = sum(degrees.values()) / len(degrees)
                print(f"  Average degree: {avg_degree:.2f}")
                print(f"  Max degree: {max(degrees.values())}")
                print(f"  Min degree: {min(degrees.values())}")
            
            # Connectivity
            is_connected = (
                nx.is_connected(graph) if not isinstance(graph, nx.DiGraph) 
                else nx.is_weakly_connected(graph)
            )
            print(f"  Connected: {is_connected}")
            
            # Node types
            type_counts = {}
            for _, attrs in graph.nodes(data=True):
                node_type = attrs.get("type", "unknown")
                type_counts[node_type] = type_counts.get(node_type, 0) + 1
            
            print(f"\nNode types:")
            for node_type, count in sorted(type_counts.items()):
                print(f"  {node_type}: {count}")
            
            # Edge types
            edge_type_counts = {}
            for _, _, attrs in graph.edges(data=True):
                edge_type = attrs.get("relationship_type", "unknown")
                edge_type_counts[edge_type] = edge_type_counts.get(edge_type, 0) + 1
            
            print(f"\nEdge types:")
            for edge_type, count in sorted(edge_type_counts.items()):
                print(f"  {edge_type}: {count}")
    
    except Exception as e:
        logger.error(f"Graph info failed: {e}")
        sys.exit(1)
    finally:
        if "client" in locals():
            client.close()


@cli.command()
@click.option("--schedule", default="0 */6 * * *", help="Cron schedule (default: every 6 hours)")
@click.option("--algorithms", default="all", help="Algorithms to run (all|centrality|community)")
@click.pass_context
def scheduler(ctx, schedule, algorithms):
    """Start the periodic scheduler."""
    config = ctx.obj["config"]
    
    if not config.enable_scheduler:
        logger.error("Scheduler is disabled in configuration")
        sys.exit(1)
    
    try:
        runner = PeriodicRunner(config)
        
        logger.info(f"Starting scheduler with cron schedule: {schedule}")
        logger.info(f"Running algorithms: {algorithms}")
        
        runner.start_scheduler(schedule, algorithms)
    except KeyboardInterrupt:
        logger.info("Scheduler stopped by user")
    except Exception as e:
        logger.error(f"Scheduler failed: {e}")
        sys.exit(1)


@cli.command()
@click.pass_context
def test_connection(ctx):
    """Test Dgraph connection."""
    config = ctx.obj["config"]
    
    try:
        logger.info(f"Testing connection to: {config.dgraph_connection_string}")
        client = DgraphClient(config.dgraph_connection_string, config.dgraph_timeout)
        
        # Test basic query
        result = client.query("{ q(func: uid(0x1)) { uid } }")
        logger.info("Connection successful!")
        
        # Test getting graph data
        nodes, edges = client.get_graph_data(limit=10)
        logger.info(f"Found {len(nodes)} nodes and {len(edges)} edges (sample)")
        
        client.close()
        
    except Exception as e:
        logger.error(f"Connection test failed: {e}")
        sys.exit(1)


def main():
    """Main CLI entry point."""
    cli()