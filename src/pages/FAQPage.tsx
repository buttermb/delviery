import { useState } from 'react';
import { ModernPage } from '@/templates/ModernPageTemplate';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Search, TrendingUp, Sparkles, HelpCircle } from 'lucide-react';
import { faqCategories, searchFAQs, getPopularFAQs } from '@/lib/faq-data';
import { FAQRating } from '@/components/faq/FAQRating';
import { FAQRelated } from '@/components/faq/FAQRelated';
import { FAQCategoryCard } from '@/components/faq/FAQCategoryCard';
import { getIconComponent } from '@/lib/icons/iconMap';

export default function FAQPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  const filteredFAQs = searchFAQs(searchQuery, selectedCategory || undefined);
  const popularFAQs = getPopularFAQs(6);

  const groupedFAQs = faqCategories.map(category => ({
    ...category,
    questions: filteredFAQs.filter(faq => faq.category === category.id)
  })).filter(category => category.questions.length > 0);

  const totalQuestions = filteredFAQs.length;

  return (
    <ModernPage
      title="Frequently Asked Questions"
      description="Find answers to common questions about FloraIQ"
      backButton
      showLogo
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">500+</div>
                <div className="text-sm text-muted-foreground mt-1">Questions Answered</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{faqCategories.length}</div>
                <div className="text-sm text-muted-foreground mt-1">Categories</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">&lt;2 min</div>
                <div className="text-sm text-muted-foreground mt-1">Avg. Support Response</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search 60+ questions across all categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 text-base"
                aria-label="Search FAQ"
              />
            </div>
            {searchQuery && (
              <div className="mt-2 text-sm text-muted-foreground">
                Found {totalQuestions} result{totalQuestions !== 1 ? 's' : ''}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Popular Questions */}
        {!searchQuery && !selectedCategory && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">Popular Questions</h3>
              </div>
              <div className="space-y-2">
                {popularFAQs.map((faq) => {
                  const Icon = getIconComponent(faqCategories.find(c => c.id === faq.category)?.icon ?? '') ?? HelpCircle;
                  return (
                    <button
                      key={faq.id}
                      onClick={() => setExpandedFAQ(faq.id)}
                      className="w-full text-left p-3 rounded-lg hover:bg-accent transition-colors group flex items-start gap-3"
                    >
                      <Icon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="font-medium group-hover:text-primary transition-colors">
                          {faq.question}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {faqCategories.find(c => c.id === faq.category)?.name}
                          </Badge>
                          {faq.difficulty && (
                            <Badge variant="outline" className="text-xs">
                              {faq.difficulty}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Category Filter */}
        {!searchQuery && (
          <div>
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Browse by Category
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {faqCategories.map((category) => {
                const categoryQuestions = searchFAQs('', category.id);
                return (
                  <FAQCategoryCard
                    key={category.id}
                    name={category.name}
                    icon={category.icon}
                    count={categoryQuestions.length}
                    onClick={() => setSelectedCategory(category.id === selectedCategory ? null : category.id)}
                    active={selectedCategory === category.id}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* FAQs by Category */}
        {groupedFAQs.length > 0 ? (
          <div className="space-y-6">
            {groupedFAQs.map((category) => {
              const Icon = getIconComponent(category.icon) ?? HelpCircle;
              return (
                <Card key={category.id} id={category.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{category.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {category.questions.length} question{category.questions.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <Accordion type="single" collapsible className="space-y-2">
                      {category.questions.map((faq) => (
                        <AccordionItem
                          key={faq.id}
                          value={faq.id}
                          id={faq.id}
                          className="border rounded-lg px-4"
                        >
                          <AccordionTrigger className="text-left hover:no-underline py-4">
                            <div className="flex items-start gap-3 flex-1">
                              <span className="font-medium flex-1">{faq.question}</span>
                              <div className="flex gap-2">
                                {faq.popular && (
                                  <Badge variant="secondary" className="text-xs">
                                    Popular
                                  </Badge>
                                )}
                                {faq.new && (
                                  <Badge className="text-xs bg-green-500">
                                    New
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-2 pb-4">
                            <div className="space-y-4">
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {faq.answer}
                              </p>
                              {faq.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {faq.tags.map((tag) => (
                                    <Badge key={tag} variant="outline" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              <FAQRating faqId={faq.id} />
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : searchQuery ? (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <p className="text-muted-foreground">
                No FAQs found matching "{searchQuery}". Try different keywords or browse by category.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* Related Questions for Expanded FAQ */}
        {expandedFAQ && <FAQRelated faqId={expandedFAQ} />}

        {/* Still Need Help */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <h3 className="font-semibold text-xl">Still have questions?</h3>
              <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
                Can't find what you're looking for? Our support team is available 24/7 to help you via email, phone, or live chat.
              </p>
              <div className="flex flex-wrap gap-4 justify-center text-sm">
                <a href="/support" className="text-primary hover:underline font-medium">
                  Contact Support →
                </a>
                <span className="text-muted-foreground">•</span>
                <a href="/contact" className="text-primary hover:underline font-medium">
                  Schedule a Demo →
                </a>
                <span className="text-muted-foreground">•</span>
                <a href="/docs" className="text-primary hover:underline font-medium">
                  View Documentation →
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ModernPage>
  );
}

