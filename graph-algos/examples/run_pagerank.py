#!/usr/bin/env python3
"""
Example: Run PageRank algorithm on Dgraph data.

This example demonstrates how to:
1. Connect to Dgraph using connection string
2. Build a NetworkX graph from entity data
3. Compute PageRank centrality
4. Write results back to Dgraph
"""

from graph_algos import Config, DgraphClient
from graph_algos.algorithms import GraphBuilder, CentralityAlgorithms


def main():
    """Run PageRank example."""
    print("🚀 PageRank Example")
    print("=" * 50)
    
    # Load configuration
    config = Config()
    print(f"📡 Connecting to: {config.dgraph_connection_string}")
    
    # Connect to Dgraph
    client = DgraphClient(config.dgraph_connection_string)
    
    try:
        # Build graph from Dgraph data
        print("\n📊 Building graph from Dgraph...")
        builder = GraphBuilder()
        nodes, edges = client.get_graph_data("Entity", limit=1000)
        
        if not nodes:
            print("❌ No entity data found in Dgraph")
            return
        
        graph = builder.build_graph(nodes, edges)
        print(f"✅ Built graph: {graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges")
        
        if graph.number_of_nodes() == 0:
            print("❌ Empty graph - no analysis possible")
            return
        
        # Initialize PageRank algorithm
        print("\n🧮 Running PageRank algorithm...")
        centrality = CentralityAlgorithms(config)
        
        # Run PageRank with custom parameters
        result = centrality.run_algorithm(
            "pagerank",
            graph,
            write_to_dgraph=True,
            dgraph_client=client,
            alpha=0.85,  # Damping parameter
            max_iter=100,  # Maximum iterations
            tol=1e-06  # Convergence tolerance
        )
        
        if not result["results"]:
            print("❌ PageRank computation failed")
            return
        
        # Display results
        print(f"✅ PageRank completed: {len(result['results'])} nodes scored")
        print(f"⏱️  Computation time: {result['metadata']['duration_seconds']:.2f}s")
        
        # Show top 10 highest PageRank scores
        scores = result["results"]
        top_nodes = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:10]
        
        print("\n🏆 Top 10 PageRank Scores:")
        print("-" * 50)
        
        for i, (node_id, score) in enumerate(top_nodes, 1):
            # Get node name if available
            node_name = "Unknown"
            for node in nodes:
                if node["uid"] == node_id:
                    node_name = node.get("name", node_id)
                    break
            
            print(f"{i:2d}. {node_name:<30} {score:.6f}")
        
        # Show some statistics
        scores_list = list(scores.values())
        avg_score = sum(scores_list) / len(scores_list)
        max_score = max(scores_list)
        min_score = min(scores_list)
        
        print(f"\n📈 PageRank Statistics:")
        print(f"   Average: {avg_score:.6f}")
        print(f"   Maximum: {max_score:.6f}")
        print(f"   Minimum: {min_score:.6f}")
        
        print(f"\n💾 Results written to Dgraph as 'pagerank_score' attributes")
        print("   You can now query: { entities(func: has(pagerank_score)) { name pagerank_score } }")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        client.close()
        print("\n✅ Done!")


if __name__ == "__main__":
    main()