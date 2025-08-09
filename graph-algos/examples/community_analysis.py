#!/usr/bin/env python3
"""
Example: Community detection and analysis on Dgraph data.

This example demonstrates how to:
1. Run Louvain community detection
2. Analyze community structure
3. Find the largest communities
4. Write results back to Dgraph
"""

from graph_algos import Config, DgraphClient
from graph_algos.algorithms import GraphBuilder, CommunityDetection


def main():
    """Run community detection example."""
    print("🏘️  Community Detection Example")
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
        nodes, edges = client.get_graph_data("Entity", limit=2000)
        
        if not nodes:
            print("❌ No entity data found in Dgraph")
            return
        
        graph = builder.build_graph(nodes, edges, min_degree=1)  # Filter isolated nodes
        print(f"✅ Built graph: {graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges")
        
        if graph.number_of_nodes() == 0:
            print("❌ Empty graph - no analysis possible")
            return
        
        # Initialize community detection
        print("\n🔍 Running Louvain community detection...")
        community_algs = CommunityDetection(config)
        
        # Run Louvain algorithm
        result = community_algs.run_algorithm(
            "louvain",
            graph,
            write_to_dgraph=True,
            dgraph_client=client,
            resolution=1.0  # Resolution parameter
        )
        
        if not result["results"]:
            print("❌ Louvain computation failed")
            return
        
        partition = result["results"]
        print(f"✅ Louvain completed: {len(partition)} nodes assigned to communities")
        print(f"⏱️  Computation time: {result['metadata']['duration_seconds']:.2f}s")
        
        # Analyze community structure
        print("\n📊 Analyzing community structure...")
        analysis = community_algs.analyze_communities(graph, partition)
        
        if "error" in analysis:
            print(f"❌ Analysis failed: {analysis['error']}")
            return
        
        print(f"🏘️  Communities found: {analysis['num_communities']}")
        print(f"📏 Average community size: {analysis['average_community_size']:.1f}")
        print(f"🏢 Largest community: {analysis['largest_community_size']} nodes")
        print(f"🏠 Smallest community: {analysis['smallest_community_size']} nodes")
        
        if analysis.get("modularity") is not None:
            print(f"📊 Modularity score: {analysis['modularity']:.4f}")
        
        # Show community size distribution
        community_sizes = analysis["community_sizes"]
        size_distribution = {}
        for size in community_sizes.values():
            size_distribution[size] = size_distribution.get(size, 0) + 1
        
        print(f"\n📈 Community Size Distribution:")
        print("-" * 40)
        for size in sorted(size_distribution.keys(), reverse=True)[:10]:
            count = size_distribution[size]
            print(f"   {count:3d} communities with {size:3d} nodes")
        
        # Show largest communities with member names
        print(f"\n🏆 Top 5 Largest Communities:")
        print("-" * 60)
        
        # Group nodes by community
        communities = {}
        for node_id, comm_id in partition.items():
            if comm_id not in communities:
                communities[comm_id] = []
            communities[comm_id].append(node_id)
        
        # Sort by size and show top 5
        largest_communities = sorted(
            communities.items(), 
            key=lambda x: len(x[1]), 
            reverse=True
        )[:5]
        
        for i, (comm_id, members) in enumerate(largest_communities, 1):
            print(f"\nCommunity {comm_id} ({len(members)} members):")
            
            # Get member names
            member_names = []
            for member_id in members[:10]:  # Show first 10 members
                for node in nodes:
                    if node["uid"] == member_id:
                        name = node.get("name", member_id)
                        node_type = node.get("type", "Unknown")
                        member_names.append(f"{name} ({node_type})")
                        break
                else:
                    member_names.append(member_id)
            
            print(f"   Members: {', '.join(member_names)}")
            if len(members) > 10:
                print(f"   ... and {len(members) - 10} more")
        
        # Run additional community detection algorithms for comparison
        print(f"\n🔄 Running additional algorithms for comparison...")
        
        # Label propagation
        lp_result = community_algs.run_algorithm(
            "label_propagation",
            graph,
            write_to_dgraph=True,
            dgraph_client=client
        )
        
        if lp_result["results"]:
            lp_analysis = community_algs.analyze_communities(graph, lp_result["results"])
            print(f"📊 Label Propagation: {lp_analysis['num_communities']} communities")
        
        print(f"\n💾 Results written to Dgraph:")
        print("   - 'louvain' attribute for community IDs")
        print("   - 'label_propagation' attribute for comparison")
        print("\n🔍 Query example:")
        print("   { entities(func: has(louvain)) { name type louvain label_propagation } }")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()
        print("\n✅ Done!")


if __name__ == "__main__":
    main()