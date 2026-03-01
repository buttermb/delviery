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
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { logger } from '@/lib/logger';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ActionConfigForm } from './ActionConfigForm';
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
  Trash2,
} from 'lucide-react';

interface NodeData {
  label?: string;
  event?: string;
  actionType?: string;
  description?: string;
  status?: string;
  condition?: string;
  config?: Record<string, unknown>;
  onDelete?: () => void;
  [key: string]: unknown;
}

// Custom Node Components
function TriggerNode({ data }: { data: NodeData }) {
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

function ActionNode({ data }: { data: NodeData }) {
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
    <Card className="p-4 border-2 border-accent min-w-[200px] relative group">
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
      {data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onDelete();
          }}
          className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </Card>
  );
}

function ConditionNode({ data }: { data: NodeData }) {
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

function CompletionNode({ data }: { data: NodeData }) {
  const isSuccess = data.status === 'success';
  return (
    <Card className={`p-4 border-2 ${isSuccess ? 'border-success' : 'border-destructive'} min-w-[200px]`}>
      <div className="flex items-center gap-2">
        {isSuccess ? (
          <CheckCircle className="h-5 w-5 text-success" />
        ) : (
          <XCircle className="h-5 w-5 text-destructive" />
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

interface Workflow {
  trigger_type?: string;
  actions?: Array<{
    id?: string;
    name?: string;
    type?: string;
    config?: Record<string, unknown>;
  }>;
  [key: string]: unknown;
}

interface VisualWorkflowEditorProps {
  workflow?: Workflow;
  onSave?: (nodes: Node[], edges: Edge[]) => void;
  readOnly?: boolean;
}

export function VisualWorkflowEditor({ workflow, onSave, readOnly = false }: VisualWorkflowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [configuringNode, setConfiguringNode] = useState<Node | null>(null);

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

  // Handle drop events from NodePalette
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowInstance) return;

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      let actionData: { label: string; type: string };
      try {
        actionData = JSON.parse(type);
      } catch (error) {
        logger.warn('Failed to parse JSON', error);
        return;
      }
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `action-${Date.now()}`,
        type: 'action',
        position,
        data: {
          label: actionData.label,
          actionType: actionData.type,
          config: {},
          onDelete: () => handleDeleteNode(`action-${Date.now()}`),
        },
      };

      setNodes((nds) => nds.concat(newNode));
      setConfiguringNode(newNode);
      setIsConfiguring(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleDeleteNode is defined below and stable (depends only on setNodes/setEdges)
    [reactFlowInstance, setNodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle node click to edit
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type === 'action' && !readOnly) {
        setConfiguringNode(node);
        setIsConfiguring(true);
      }
    },
    [readOnly]
  );

  // Handle node deletion
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    },
    [setNodes, setEdges]
  );

  // Save node configuration
  const handleSaveNodeConfig = useCallback(
    (name: string, config: Record<string, unknown>) => {
      if (!configuringNode) return;

      setNodes((nds) =>
        nds.map((n) =>
          n.id === configuringNode.id
            ? {
                ...n,
                data: {
                  ...n.data,
                  label: name,
                  config,
                  description: config.description ?? '',
                },
              }
            : n
        )
      );

      setIsConfiguring(false);
      setConfiguringNode(null);
    },
    [configuringNode, setNodes]
  );

  // Add delete handlers to existing action nodes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.type === 'action' && !node.data.onDelete) {
          return {
            ...node,
            data: {
              ...node.data,
              onDelete: () => handleDeleteNode(node.id),
            },
          };
        }
        return node;
      })
    );
  }, [handleDeleteNode, setNodes]);

  const handleSave = () => {
    if (onSave) {
      // Note: actions could be derived from nodes if needed by sorting by Y position
      // and mapping type='action' nodes to { id, name, type, config }
      onSave(nodes, edges);
    }
  };

  return (
    <div className="h-[600px] w-full border rounded-lg overflow-hidden relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onInit={setReactFlowInstance}
        nodeTypes={nodeTypes}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.5}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        preventScrolling={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        panOnScroll={false}
        panOnDrag={true}
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

      {/* Node Configuration Dialog */}
      <Dialog open={isConfiguring} onOpenChange={setIsConfiguring}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {configuringNode ? `Configure ${configuringNode.data.actionType.replace('_', ' ')}` : 'Configure Action'}
            </DialogTitle>
          </DialogHeader>
          {configuringNode && (
            <ActionConfigForm
              actionType={configuringNode.data.actionType}
              actionName={configuringNode.data.label}
              config={configuringNode.data.config || {}}
              onSave={handleSaveNodeConfig}
              onCancel={() => {
                setIsConfiguring(false);
                setConfiguringNode(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper functions to convert workflow data to nodes/edges
function convertWorkflowToNodes(workflow: Workflow): Node[] {
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
    workflow.actions.forEach((action, index: number) => {
      nodes.push({
        id: action.id || `action-${index + 1}`,
        type: 'action',
        position: { x: 250, y: yOffset },
        data: {
          label: action.name || `Action ${index + 1}`,
          actionType: action.type,
          config: action.config || {},
          description: action.config?.description ?? '',
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

function convertWorkflowToEdges(workflow: Workflow): Edge[] {
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
