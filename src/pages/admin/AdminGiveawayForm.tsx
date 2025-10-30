import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, Save } from 'lucide-react';

export default function AdminGiveawayForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    tagline: '',
    description: '',
    start_date: '',
    end_date: '',
    status: 'draft',
    grand_prize_title: '1 LB Premium Flower',
    grand_prize_description: 'Full pound delivered same-day',
    grand_prize_value: 4000,
    second_prize_title: '$200 Bud Dash Credit',
    second_prize_value: 200,
    third_prize_title: '$50 Bud Dash Credit',
    third_prize_value: 50,
    base_entries: 1,
    newsletter_bonus_entries: 1,
    instagram_story_bonus_entries: 2,
    instagram_post_bonus_entries: 5,
    referral_bonus_entries: 3
  });

  useEffect(() => {
    if (isEdit) {
      loadGiveaway();
    }
  }, [id]);

  const loadGiveaway = async () => {
    try {
      const { data, error } = await supabase
        .from('giveaways')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Format dates for input
      setFormData({
        ...data,
        start_date: new Date(data.start_date).toISOString().slice(0, 16),
        end_date: new Date(data.end_date).toISOString().slice(0, 16)
      });
    } catch (error: any) {
      console.error('Error loading giveaway:', error);
      toast.error(error.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        grand_prize_value: parseFloat(formData.grand_prize_value as any),
        second_prize_value: parseFloat(formData.second_prize_value as any),
        third_prize_value: parseFloat(formData.third_prize_value as any)
      };

      if (isEdit) {
        const { error } = await supabase
          .from('giveaways')
          .update(submitData)
          .eq('id', id);

        if (error) throw error;
        toast.success('Giveaway updated successfully!');
      } else {
        const { error } = await supabase
          .from('giveaways')
          .insert([submitData]);

        if (error) throw error;
        toast.success('Giveaway created successfully!');
      }

      navigate('/admin/giveaways');
    } catch (error: any) {
      console.error('Error saving giveaway:', error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => navigate('/admin/giveaways')}
        className="mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Giveaways
      </Button>

      <h1 className="text-3xl font-bold mb-8">
        {isEdit ? 'Edit Giveaway' : 'Create New Giveaway'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="NYC's Biggest Flower Giveaway"
                required
              />
            </div>

            <div>
              <Label htmlFor="slug">URL Slug *</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="nyc-biggest-flower"
                required
              />
              <p className="text-sm text-muted-foreground mt-1">
                Will be used in URL: /giveaway/{formData.slug || 'your-slug'}
              </p>
            </div>

            <div>
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                placeholder="Win 1 LB of Premium Flower"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter to win $4,000+ in premium NYC flower..."
                rows={4}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_date">Start Date & Time *</Label>
                <Input
                  id="start_date"
                  type="datetime-local"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="end_date">End Date & Time *</Label>
                <Input
                  id="end_date"
                  type="datetime-local"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="ended">Ended</option>
                <option value="winners_selected">Winners Selected</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prizes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4 p-4 bg-card border border-primary/20 rounded-lg">
              <h3 className="font-semibold flex items-center gap-2 text-primary">
                <span>🥇</span> Grand Prize
              </h3>
              <div>
                <Label htmlFor="grand_prize_title">Title *</Label>
                <Input
                  id="grand_prize_title"
                  value={formData.grand_prize_title}
                  onChange={(e) => setFormData({ ...formData, grand_prize_title: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="grand_prize_description">Description</Label>
                <Input
                  id="grand_prize_description"
                  value={formData.grand_prize_description}
                  onChange={(e) => setFormData({ ...formData, grand_prize_description: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="grand_prize_value">Value ($) *</Label>
                <Input
                  id="grand_prize_value"
                  type="number"
                  step="0.01"
                  value={formData.grand_prize_value}
                  onChange={(e) => setFormData({ ...formData, grand_prize_value: parseFloat(e.target.value) })}
                  required
                />
              </div>
            </div>

            <div className="space-y-4 p-4 bg-muted/50 border border-border rounded-lg">
              <h3 className="font-semibold flex items-center gap-2">
                <span>🥈</span> Second Prize
              </h3>
              <div>
                <Label htmlFor="second_prize_title">Title *</Label>
                <Input
                  id="second_prize_title"
                  value={formData.second_prize_title}
                  onChange={(e) => setFormData({ ...formData, second_prize_title: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="second_prize_value">Value ($) *</Label>
                <Input
                  id="second_prize_value"
                  type="number"
                  step="0.01"
                  value={formData.second_prize_value}
                  onChange={(e) => setFormData({ ...formData, second_prize_value: parseFloat(e.target.value) })}
                  required
                />
              </div>
            </div>

            <div className="space-y-4 p-4 bg-muted/50 border border-border rounded-lg">
              <h3 className="font-semibold flex items-center gap-2">
                <span>🥉</span> Third Prize
              </h3>
              <div>
                <Label htmlFor="third_prize_title">Title *</Label>
                <Input
                  id="third_prize_title"
                  value={formData.third_prize_title}
                  onChange={(e) => setFormData({ ...formData, third_prize_title: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="third_prize_value">Value ($) *</Label>
                <Input
                  id="third_prize_value"
                  type="number"
                  step="0.01"
                  value={formData.third_prize_value}
                  onChange={(e) => setFormData({ ...formData, third_prize_value: parseFloat(e.target.value) })}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Entry Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="base_entries">Base Entries</Label>
                <Input
                  id="base_entries"
                  type="number"
                  value={formData.base_entries}
                  onChange={(e) => setFormData({ ...formData, base_entries: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="newsletter_bonus_entries">Newsletter Bonus</Label>
                <Input
                  id="newsletter_bonus_entries"
                  type="number"
                  value={formData.newsletter_bonus_entries}
                  onChange={(e) => setFormData({ ...formData, newsletter_bonus_entries: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="instagram_story_bonus_entries">Instagram Story Bonus</Label>
                <Input
                  id="instagram_story_bonus_entries"
                  type="number"
                  value={formData.instagram_story_bonus_entries}
                  onChange={(e) => setFormData({ ...formData, instagram_story_bonus_entries: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="instagram_post_bonus_entries">Instagram Post Bonus</Label>
                <Input
                  id="instagram_post_bonus_entries"
                  type="number"
                  value={formData.instagram_post_bonus_entries}
                  onChange={(e) => setFormData({ ...formData, instagram_post_bonus_entries: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="referral_bonus_entries">Referral Bonus (per friend)</Label>
                <Input
                  id="referral_bonus_entries"
                  type="number"
                  value={formData.referral_bonus_entries}
                  onChange={(e) => setFormData({ ...formData, referral_bonus_entries: parseInt(e.target.value) })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading}
            size="lg"
            className="flex-1"
          >
            {loading ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {isEdit ? 'Update Giveaway' : 'Create Giveaway'}
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/admin/giveaways')}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
