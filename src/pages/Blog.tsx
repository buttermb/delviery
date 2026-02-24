import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Calendar, User, ArrowRight, Search } from "lucide-react";

export default function Blog() {
  const blogPosts = [
    {
      title: "10 Ways to Optimize Your Wholesale Distribution Workflow",
      excerpt: "Discover proven strategies to streamline operations, reduce costs, and increase efficiency in your distribution business.",
      category: "Best Practices",
      author: "Sarah Johnson",
      date: "March 18, 2025",
      readTime: "8 min read",
      image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&h=400&fit=crop"
    },
    {
      title: "The Future of B2B Commerce: Trends for 2025",
      excerpt: "Explore the latest trends shaping wholesale distribution, from AI automation to mobile-first experiences.",
      category: "Industry Insights",
      author: "Michael Chen",
      date: "March 15, 2025",
      readTime: "6 min read",
      image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=400&fit=crop"
    },
    {
      title: "How to Choose the Right Distribution Management Software",
      excerpt: "A comprehensive guide to evaluating and selecting the perfect software solution for your wholesale business.",
      category: "Guides",
      author: "Emily Rodriguez",
      date: "March 12, 2025",
      readTime: "10 min read",
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=400&fit=crop"
    },
    {
      title: "Managing Inventory in a Multi-Location Distribution Network",
      excerpt: "Best practices for maintaining optimal inventory levels across multiple warehouses and distribution centers.",
      category: "Operations",
      author: "David Park",
      date: "March 10, 2025",
      readTime: "7 min read",
      image: "https://images.unsplash.com/photo-1553413077-190dd305871c?w=800&h=400&fit=crop"
    },
    {
      title: "Customer Success Story: How ABC Distributors 3x Their Growth",
      excerpt: "Learn how one distributor transformed their business using modern technology and data-driven insights.",
      category: "Case Studies",
      author: "Lisa Thompson",
      date: "March 8, 2025",
      readTime: "5 min read",
      image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=400&fit=crop"
    },
    {
      title: "Understanding the ROI of Distribution Management Systems",
      excerpt: "Calculate the true return on investment when implementing new distribution software in your business.",
      category: "Business",
      author: "James Wilson",
      date: "March 5, 2025",
      readTime: "9 min read",
      image: "https://images.unsplash.com/photo-1590650153855-d9e808231d41?w=800&h=400&fit=crop"
    }
  ];

  const categories = ["All Posts", "Best Practices", "Industry Insights", "Guides", "Operations", "Case Studies", "Business"];

  return (
    <div className="min-h-dvh bg-background">
      <SEOHead
        title="Blog - Insights & Resources | FloraIQ"
        description="Read the latest insights, best practices, and industry trends for wholesale distribution management. Expert tips to help grow your business."
      />

      <MarketingNav />

      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-4">Blog</Badge>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 text-foreground">
              Insights for Modern
              <span className="block text-primary">Distributors</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Expert tips, industry trends, and best practices to help you grow your wholesale business.
            </p>

            {/* Search Bar */}
            <div className="relative max-w-xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search articles..."
                className="pl-12 h-12"
                aria-label="Search articles"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-8 border-b">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap gap-2 justify-center">
            {categories.map((category) => (
              <Button
                key={category}
                variant={category === "All Posts" ? "default" : "outline"}
                size="sm"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Post */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="overflow-hidden hover:shadow-lg transition-shadow max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-0">
              <div className="relative h-64 md:h-auto">
                <img
                  src={blogPosts[0].image}
                  alt={blogPosts[0].title}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <CardContent className="p-8 flex flex-col justify-center">
                <Badge className="w-fit mb-4">{blogPosts[0].category}</Badge>
                <h2 className="text-3xl font-bold mb-4 text-foreground">
                  {blogPosts[0].title}
                </h2>
                <p className="text-muted-foreground mb-6">{blogPosts[0].excerpt}</p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {blogPosts[0].author}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {blogPosts[0].date}
                  </div>
                  <div className="flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    {blogPosts[0].readTime}
                  </div>
                </div>
                <Button className="w-fit">
                  Read Article
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </div>
          </Card>
        </div>
      </section>

      {/* Blog Grid */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {blogPosts.slice(1).map((post, index) => (
              <Card key={index} className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
                <div className="relative h-48">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <CardContent className="p-6 flex flex-col flex-1">
                  <Badge className="w-fit mb-4">{post.category}</Badge>
                  <h3 className="text-xl font-semibold mb-3 text-foreground">
                    {post.title}
                  </h3>
                  <p className="text-muted-foreground mb-4 flex-1">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                    <span>{post.author}</span>
                    <span>•</span>
                    <span>{post.date}</span>
                    <span>•</span>
                    <span>{post.readTime}</span>
                  </div>
                  <Button variant="link" className="p-0 w-fit">
                    Read More →
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Load More */}
          <div className="text-center mt-12">
            <Button variant="outline" size="lg">
              Load More Articles
            </Button>
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <CardContent className="p-8 text-center">
                <h2 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
                  Never Miss an Update
                </h2>
                <p className="text-muted-foreground mb-6">
                  Subscribe to our newsletter for the latest insights, tips, and industry news.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    className="flex-1"
                    aria-label="Email for newsletter"
                  />
                  <Button>Subscribe</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
