/**
 * Action Configuration Form
 * Dynamic form that changes based on action type
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ActionConfigFormProps {
  actionType: string;
  actionName: string;
  config: Record<string, unknown>;
  onSave: (name: string, config: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function ActionConfigForm({ 
  actionType, 
  actionName,
  config, 
  onSave, 
  onCancel 
}: ActionConfigFormProps) {
  const [name, setName] = useState(actionName || '');
  const [formData, setFormData] = useState(config);

  const handleSubmit = () => {
    onSave(name, formData);
  };

  const renderFields = () => {
    switch (actionType) {
      case 'send_email':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="to">To Email *</Label>
              <Input 
                id="to"
                placeholder="user@example.com or {{trigger.customer_email}}"
                value={formData.to || ''} 
                onChange={(e) => setFormData({...formData, to: e.target.value})}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use {`{{variable}}`} for dynamic values
              </p>
            </div>
            <div>
              <Label htmlFor="subject">Subject *</Label>
              <Input 
                id="subject"
                placeholder="Order Confirmation #{{trigger.order_id}}"
                value={formData.subject || ''}
                onChange={(e) => setFormData({...formData, subject: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="body">Email Body *</Label>
              <Textarea 
                id="body"
                placeholder="Your order has been received..."
                value={formData.body || ''}
                onChange={(e) => setFormData({...formData, body: e.target.value})}
                rows={6}
              />
            </div>
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <p className="text-sm font-medium mb-2">Available Variables:</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{`{{trigger.order_id}}`}</Badge>
                  <Badge variant="outline">{`{{trigger.customer_email}}`}</Badge>
                  <Badge variant="outline">{`{{trigger.total_amount}}`}</Badge>
                  <Badge variant="outline">{`{{trigger.status}}`}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'send_sms':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="to">Phone Number *</Label>
              <Input 
                id="to"
                placeholder="+1234567890 or {{trigger.customer_phone}}"
                value={formData.to || ''}
                onChange={(e) => setFormData({...formData, to: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="message">Message *</Label>
              <Textarea 
                id="message"
                placeholder="Your order #{{trigger.order_id}} is confirmed!"
                value={formData.message || ''}
                onChange={(e) => setFormData({...formData, message: e.target.value})}
                rows={4}
                maxLength={160}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {(formData.message || '').length}/160 characters
              </p>
            </div>
          </div>
        );

      case 'call_webhook':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="url">Webhook URL *</Label>
              <Input 
                id="url"
                placeholder="https://api.example.com/webhook"
                value={formData.url || ''}
                onChange={(e) => setFormData({...formData, url: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="method">HTTP Method</Label>
              <Select 
                value={formData.method || 'POST'}
                onValueChange={(value) => setFormData({...formData, method: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="headers">Headers (JSON)</Label>
              <Textarea 
                id="headers"
                placeholder='{"Authorization": "Bearer token", "Content-Type": "application/json"}'
                value={formData.headers ? JSON.stringify(formData.headers, null, 2) : '{}'}
                onChange={(e) => {
                  try {
                    const headers = JSON.parse(e.target.value);
                    setFormData({...formData, headers});
                  } catch {}
                }}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="body">Request Body (JSON)</Label>
              <Textarea 
                id="body"
                placeholder='{"order_id": "{{trigger.order_id}}", "status": "{{trigger.status}}"}'
                value={formData.body ? JSON.stringify(formData.body, null, 2) : '{}'}
                onChange={(e) => {
                  try {
                    const body = JSON.parse(e.target.value);
                    setFormData({...formData, body});
                  } catch {}
                }}
                rows={4}
              />
            </div>
          </div>
        );

      case 'database_query':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="operation">Operation *</Label>
              <Select 
                value={formData.operation || 'insert'}
                onValueChange={(value) => setFormData({...formData, operation: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="insert">Insert</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="select">Select</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="table">Table Name *</Label>
              <Input 
                id="table"
                placeholder="orders"
                value={formData.table || ''}
                onChange={(e) => setFormData({...formData, table: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="data">Data (JSON) *</Label>
              <Textarea 
                id="data"
                placeholder='{"status": "processing", "updated_at": "now()"}'
                value={formData.data ? JSON.stringify(formData.data, null, 2) : '{}'}
                onChange={(e) => {
                  try {
                    const data = JSON.parse(e.target.value);
                    setFormData({...formData, data});
                  } catch {}
                }}
                rows={6}
              />
            </div>
            {(formData.operation === 'update' || formData.operation === 'delete') && (
              <div>
                <Label htmlFor="filter">Filter (JSON)</Label>
                <Textarea 
                  id="filter"
                  placeholder='{"id": "{{trigger.order_id}}"}'
                  value={formData.filter ? JSON.stringify(formData.filter, null, 2) : '{}'}
                  onChange={(e) => {
                    try {
                      const filter = JSON.parse(e.target.value);
                      setFormData({...formData, filter});
                    } catch {}
                  }}
                  rows={3}
                />
              </div>
            )}
          </div>
        );

      case 'assign_courier':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="order_id">Order ID Source *</Label>
              <Input 
                id="order_id"
                placeholder="{{trigger.order_id}}"
                value={formData.order_id_source || ''}
                onChange={(e) => setFormData({...formData, order_id_source: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="selection_method">Selection Method</Label>
              <Select 
                value={formData.selection_method || 'nearest'}
                onValueChange={(value) => setFormData({...formData, selection_method: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nearest">Nearest Courier</SelectItem>
                  <SelectItem value="least_busy">Least Busy</SelectItem>
                  <SelectItem value="round_robin">Round Robin</SelectItem>
                  <SelectItem value="random">Random</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="notify">Notify Courier</Label>
              <Select 
                value={formData.notify_courier ? 'true' : 'false'}
                onValueChange={(value) => setFormData({...formData, notify_courier: value === 'true'})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'update_inventory':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="product_id">Product ID Source *</Label>
              <Input 
                id="product_id"
                placeholder="{{trigger.product_id}}"
                value={formData.product_id_source || ''}
                onChange={(e) => setFormData({...formData, product_id_source: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="quantity_change">Quantity Change *</Label>
              <Input 
                id="quantity_change"
                type="number"
                placeholder="-1 or {{trigger.quantity}}"
                value={formData.quantity_change || ''}
                onChange={(e) => setFormData({...formData, quantity_change: e.target.value})}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use negative values to decrease inventory
              </p>
            </div>
            <div>
              <Label htmlFor="warehouse">Warehouse (optional)</Label>
              <Input 
                id="warehouse"
                placeholder="main_warehouse or {{trigger.warehouse_id}}"
                value={formData.warehouse_id || ''}
                onChange={(e) => setFormData({...formData, warehouse_id: e.target.value})}
              />
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="config">Configuration (JSON)</Label>
              <Textarea
                id="config"
                placeholder='{"key": "value"}'
                value={JSON.stringify(formData, null, 2)}
                onChange={(e) => {
                  try {
                    setFormData(JSON.parse(e.target.value));
                  } catch {}
                }}
                rows={10}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter valid JSON configuration
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="action-name">Action Name *</Label>
        <Input
          id="action-name"
          placeholder="e.g., Send Order Confirmation Email"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {renderFields()}

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!name}>
          Save Configuration
        </Button>
      </div>
    </div>
  );
}
