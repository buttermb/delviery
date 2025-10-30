import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import DOMPurify from 'dompurify';

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const { data: post, isLoading } = useQuery({
    queryKey: ["blog-post", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Blog post not found");
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Post not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => navigate("/blog")} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Blog
        </Button>

        {post.featured_image_url && (
          <img
            src={post.featured_image_url}
            alt={post.title}
            className="w-full h-64 md:h-96 object-cover rounded-lg mb-6"
          />
        )}

        <h1 className="text-4xl font-bold mb-4">{post.title}</h1>

        <p className="text-muted-foreground mb-8">
          {new Date(post.created_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>

        <div className="prose prose-lg max-w-none dark:prose-invert">
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }} />
        </div>
      </div>
    </div>
  );
};

export default BlogPost;
