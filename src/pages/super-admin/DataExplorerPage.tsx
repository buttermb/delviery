/**
 * Data Explorer Page
 * SQL query builder and data exploration interface
 * Inspired by DBeaver, Metabase, and TablePlus
 */

import { QueryBuilder } from '@/components/super-admin/data/QueryBuilder';
import { SchemaVisualizer } from '@/components/super-admin/data/SchemaVisualizer';
import { PageHeader } from '@/components/super-admin/ui/PageHeader';
import { SEOHead } from '@/components/SEOHead';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, Search } from 'lucide-react';

export default function DataExplorerPage() {
  return (
    <>
      <SEOHead title="Data Explorer - Super Admin" />
      <div className="container mx-auto p-6 space-y-6">
        <PageHeader
          title="Data Explorer"
          description="Build and execute SQL queries to explore your database"
          icon={Database}
        />

        <Tabs defaultValue="query" className="space-y-4">
          <TabsList>
            <TabsTrigger value="query">Query Builder</TabsTrigger>
            <TabsTrigger value="schema">Schema Visualizer</TabsTrigger>
          </TabsList>
          <TabsContent value="query">
            <QueryBuilder />
          </TabsContent>
          <TabsContent value="schema">
            <SchemaVisualizer />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

