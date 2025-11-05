/**
 * Visual Workflow Editor
 * Drag-and-drop workflow builder with nodes and connections
 */

import { useCallback, useState, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeTypes,
  BackgroundVariant,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Zap, 
  Mail, 
  MessageSquare, 
  Database, 
  Webhook,
  GitBranch,
  CheckCircle,
  XCircle,
} from 'lucide-react';

// Custom Node Components
function TriggerNode({ data }: { data: any }) {
  return (
    <Card className="p-4 border-2 border-primary min-w-[200px]">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-5 w-5 text-primary" />
        <span className="font-semibold">Trigger</span>
      </div>
      <div className="text-sm text-muted-foreground">{data.label}</div>
      {data.event && (
        <Badge variant="outline" className="mt-2">
          {data.event}
        </Badge>
      )}
    </Card>
  );
}

function ActionNode({ data }: { data: any }) {
  const getIcon = () => {
    switch (data.actionType) {
      case 'send_email': return <Mail className="h-4 w-4" />;
      case 'send_sms': return <MessageSquare className="h-4 w-4" />;
      case 'database_query': return <Database className="h-4 w-4" />;
      case 'call_webhook': return <Webhook className="h-4 w-4" />;
      case 'assign_courier': return <Play className="h-4 w-4" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  return (
    <Card className="p-4 border-2 border-accent min-w-[200px]">
      <div className="flex items-center gap-2 mb-2">
        {getIcon()}
        <span className="font-semibold">{data.label}</span>
      </div>
      {data.description && (
        <div className="text-xs text-muted-foreground mt-1">
          {data.description}
        </div>
      )}
      {data.status && (
        <Badge variant="secondary" className="mt-2">
          {data.status}
        </Badge>
      )}
    </Card>
  );
}

function ConditionNode({ data }: { data: any }) {
  return (
    <Card className="p-4 border-2 border-warning min-w-[200px]">
      <div className="flex items-center gap-2 mb-2">
        <GitBranch className="h-4 w-4 text-warning" />
        <span className="font-semibold">Condition</span>
      </div>
      {data.condition && (
        <div className="text-xs text-muted-foreground mt-1">
          {data.condition}
        </div>
      )}
    </Card>
  );
}

function CompletionNode({ data }: { data: any }) {
  const isSuccess = data.status === 'success';
  return (
    <Card className={`p-4 border-2 ${isSuccess ? 'border-green-500' : 'border-red-500'} min-w-[200px]`}>
      <div className="flex items-center gap-2">
        {isSuccess ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : (
          <XCircle className="h-5 w-5 text-red-500" />
        )}
        <span className="font-semibold">{data.label}</span>
      </div>
    </Card>
  );
}

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  completion: CompletionNode,
};

interface VisualWorkflowEditorProps {
  workflow?: any;
  onSave?: (nodes: Node[], edges: Edge[]) => void;
  readOnly?: boolean;
}

export function VisualWorkflowEditor({ workflow, onSave, readOnly = false }: VisualWorkflowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Load workflow into visual editor
  useEffect(() => {
    if (workflow) {
      const visualNodes = convertWorkflowToNodes(workflow);
      const visualEdges = convertWorkflowToEdges(workflow);
      setNodes(visualNodes);
      setEdges(visualEdges);
    } else {
      // Default empty workflow with trigger
      setNodes([
        {
          id: 'trigger-1',
          type: 'trigger',
          position: { x: 250, y: 50 },
          data: { 
            label: 'Workflow Trigger',
            event: workflow?.trigger_type || 'Select trigger event'
          },
        },
        {
          id: 'completion-1',
          type: 'completion',
          position: { x: 250, y: 400 },
          data: { 
            label: 'Workflow Complete',
            status: 'success'
          },
        },
      ]);
      setEdges([]);
    }
  }, [workflow, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'smoothstep',
            animated: true,
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const handleSave = () => {
    if (onSave) {
      onSave(nodes, edges);
    }
  };

  return (
    <div className="h-[600px] w-full border rounded-lg overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <Controls />
      </ReactFlow>

      {!readOnly && (
        <div className="absolute bottom-4 right-4 z-10 flex gap-2">
          <Button onClick={handleSave} size="sm">
            Save Workflow
          </Button>
        </div>
      )}
    </div>
  );
}

// Helper functions to convert workflow data to nodes/edges
function convertWorkflowToNodes(workflow: any): Node[] {
  const nodes: Node[] = [];
  let yOffset = 50;

  // Trigger node
  nodes.push({
    id: 'trigger-1',
    type: 'trigger',
    position: { x: 250, y: yOffset },
    data: {
      label: 'Workflow Trigger',
      event: workflow.trigger_type || 'database_event',
    },
  });

  yOffset += 120;

  // Action nodes
  if (workflow.actions && Array.isArray(workflow.actions)) {
    workflow.actions.forEach((action: any, index: number) => {
      nodes.push({
        id: `action-${index + 1}`,
        type: 'action',
        position: { x: 250, y: yOffset },
        data: {
          label: action.name || `Action ${index + 1}`,
          actionType: action.type,
          description: action.config?.description,
          status: 'ready',
        },
      });
      yOffset += 120;
    });
  }

  // Completion node
  nodes.push({
    id: 'completion-1',
    type: 'completion',
    position: { x: 250, y: yOffset },
    data: {
      label: 'Workflow Complete',
      status: 'success',
    },
  });

  return nodes;
}

function convertWorkflowToEdges(workflow: any): Edge[] {
  const edges: Edge[] = [];

  if (!workflow.actions || workflow.actions.length === 0) {
    return [];
  }

  // Connect trigger to first action
  edges.push({
    id: 'e-trigger-action1',
    source: 'trigger-1',
    target: 'action-1',
    type: 'smoothstep',
    animated: true,
    markerEnd: {
      type: MarkerType.ArrowClosed,
    },
  });

  // Connect actions in sequence
  for (let i = 0; i < workflow.actions.length - 1; i++) {
    edges.push({
      id: `e-action${i + 1}-action${i + 2}`,
      source: `action-${i + 1}`,
      target: `action-${i + 2}`,
      type: 'smoothstep',
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
    });
  }

  // Connect last action to completion
  edges.push({
    id: `e-action${workflow.actions.length}-completion`,
    source: `action-${workflow.actions.length}`,
    target: 'completion-1',
    type: 'smoothstep',
    animated: true,
    markerEnd: {
      type: MarkerType.ArrowClosed,
    },
  });

  return edges;
}
