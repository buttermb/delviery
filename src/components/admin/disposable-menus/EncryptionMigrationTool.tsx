// @ts-nocheck - Types will update after encryption migration is applied
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Shield, Loader2, CheckCircle, AlertTriangle, Lock, Database, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface EncryptionMigrationToolProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
}

interface MenuStatus {
  id: string;
  name: string;
  is_encrypted: boolean;
  status: 'pending' | 'encrypting' | 'success' | 'error';
  error?: string;
}

export const EncryptionMigrationTool = ({ open, onOpenChange, tenantId }: EncryptionMigrationToolProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [menuStatuses, setMenuStatuses] = useState<MenuStatus[]>([]);
  const [progress, setProgress] = useState(0);

  const scanMenus = async () => {
    setIsScanning(true);
    try {
      const { data: menus, error } = await supabase
        .from('disposable_menus')
        .select('id, name, is_encrypted')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false});

      if (error) throw error;

      const statuses: MenuStatus[] = (menus || []).map(menu => ({
        id: menu.id,
        name: menu.name || 'Untitled Menu',
        is_encrypted: menu.is_encrypted || false,
        status: 'pending',
      }));

      setMenuStatuses(statuses);
      
      const unencryptedCount = statuses.filter(m => !m.is_encrypted).length;
      toast.info('Scan Complete', {
        description: `Found ${unencryptedCount} unencrypted menu${unencryptedCount !== 1 ? 's' : ''} requiring migration`,
      });
    } catch (error) {
      logger.error('Menu scan failed', error, { component: 'EncryptionMigrationTool' });
      toast.error('Scan Failed', {
        description: error instanceof Error ? error.message : 'Could not scan menus',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleSendReport = async () => {
    try {
      setSendingReport(true);
      const { data, error } = await supabase.functions.invoke('weekly-encryption-report');

      if (error) throw error;

      toast.success('Encryption report sent successfully', {
        description: `Sent to ${data.reports_sent} tenant admin${data.reports_sent !== 1 ? 's' : ''}`,
      });
    } catch (error: any) {
      logger.error('Report error', error, { component: 'EncryptionMigrationTool' });
      toast.error('Failed to send report', {
        description: error.message,
      });
    } finally {
      setSendingReport(false);
    }
  };

  const migrateMenus = async () => {
    const unencryptedMenus = menuStatuses.filter(m => !m.is_encrypted);
    
    if (unencryptedMenus.length === 0) {
      toast.info('No Migration Needed', {
        description: 'All menus are already encrypted',
      });
      return;
    }

    setIsMigrating(true);
    setProgress(0);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < unencryptedMenus.length; i++) {
      const menu = unencryptedMenus[i];
      
      // Update status to encrypting
      setMenuStatuses(prev => 
        prev.map(m => m.id === menu.id ? { ...m, status: 'encrypting' as const } : m)
      );

      try {
        // Call the encryption function
        const { data, error } = await supabase.rpc('encrypt_disposable_menu', {
          menu_id: menu.id
        });

        if (error) throw error;

        if (!data) {
          throw new Error('Encryption function returned false');
        }

        // Update status to success
        setMenuStatuses(prev => 
          prev.map(m => m.id === menu.id ? { ...m, status: 'success' as const, is_encrypted: true } : m)
        );
        successCount++;

        logger.info('Menu encrypted successfully', { menuId: menu.id, menuName: menu.name });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Update status to error
        setMenuStatuses(prev => 
          prev.map(m => m.id === menu.id ? { ...m, status: 'error' as const, error: errorMessage } : m)
        );
        errorCount++;

        logger.error('Menu encryption failed', error, { 
          component: 'EncryptionMigrationTool',
          menuId: menu.id,
          menuName: menu.name 
        });
      }

      // Update progress
      setProgress(((i + 1) / unencryptedMenus.length) * 100);
    }

    setIsMigrating(false);

    if (errorCount === 0) {
      toast.success('Migration Complete', {
        description: `Successfully encrypted ${successCount} menu${successCount !== 1 ? 's' : ''}`,
      });
    } else {
      toast.warning('Migration Completed with Errors', {
        description: `${successCount} succeeded, ${errorCount} failed. Check logs for details.`,
      });
    }
  };

  const encryptedCount = menuStatuses.filter(m => m.is_encrypted).length;
  const unencryptedCount = menuStatuses.filter(m => !m.is_encrypted).length;
  const successCount = menuStatuses.filter(m => m.status === 'success').length;
  const errorCount = menuStatuses.filter(m => m.status === 'error').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <DialogTitle>AES-256 Encryption Migration</DialogTitle>
          </div>
          <DialogDescription>
            Encrypt existing disposable menus with bank-level AES-256 encryption
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Lock className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{encryptedCount}</div>
                  <div className="text-sm text-muted-foreground">Encrypted</div>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <Database className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{unencryptedCount}</div>
                  <div className="text-sm text-muted-foreground">Unencrypted</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button 
              onClick={scanMenus} 
              disabled={isScanning || isMigrating}
              variant="outline"
              className="flex-1"
            >
              {isScanning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Scan Menus
            </Button>
            
            <Button 
              onClick={migrateMenus}
              disabled={isMigrating || isScanning || menuStatuses.length === 0 || unencryptedCount === 0}
              className="flex-1"
            >
              {isMigrating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isMigrating ? 'Encrypting...' : `Encrypt ${unencryptedCount} Menu${unencryptedCount !== 1 ? 's' : ''}`}
            </Button>
          </div>

          {/* Progress Bar */}
          {isMigrating && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Migration Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Results Summary */}
          {successCount > 0 || errorCount > 0 ? (
            <div className="flex gap-4 p-4 bg-muted/50 rounded-lg">
              {successCount > 0 && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">{successCount} succeeded</span>
                </div>
              )}
              {errorCount > 0 && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">{errorCount} failed</span>
                </div>
              )}
            </div>
          ) : null}

          {/* Menu List */}
          {menuStatuses.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Menus</h3>
                <Badge variant="outline">{menuStatuses.length} total</Badge>
              </div>
              
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {menuStatuses.map(menu => (
                  <Card key={menu.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{menu.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {menu.id.slice(0, 8)}...
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        {menu.is_encrypted ? (
                          <Badge variant="default" className="gap-1">
                            <Lock className="h-3 w-3" />
                            Encrypted
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <Database className="h-3 w-3" />
                            Plaintext
                          </Badge>
                        )}
                        
                        {menu.status === 'encrypting' && (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        )}
                        {menu.status === 'success' && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                        {menu.status === 'error' && (
                          <div className="relative group">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            {menu.error && (
                              <div className="absolute hidden group-hover:block bottom-full right-0 mb-2 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg whitespace-nowrap z-10">
                                {menu.error}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {menu.error && (
                      <div className="mt-2 text-xs text-red-500">
                        Error: {menu.error}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Weekly Reports Section */}
          <div className="border-t pt-4 mt-4">
            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
              <Mail className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-sm mb-1">Weekly Encryption Reports</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Automated reports are sent every Monday to tenant admins with unencrypted menus.
                  You can also trigger a manual report now.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSendReport}
                  disabled={sendingReport}
                >
                  {sendingReport ? "Sending..." : "Send Report Now"}
                </Button>
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex gap-3">
              <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <div className="font-semibold">About AES-256 Encryption</div>
                <div className="text-muted-foreground">
                  This tool encrypts menu names, descriptions, prices, and security settings using AES-256-CBC encryption. 
                  Encrypted data is unreadable without the decryption key and meets HIPAA, PCI-DSS, and GDPR compliance requirements.
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={scanMenus}
              disabled={isScanning || isMigrating}
              className="flex-1"
            >
              {isScanning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Database className="mr-2 h-4 w-4" />
                  Scan Again
                </>
              )}
            </Button>
            <Button
              onClick={migrateMenus}
              disabled={isScanning || isMigrating || menuStatuses.filter(m => !m.is_encrypted).length === 0}
              className="flex-1"
            >
              {isMigrating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Encrypting...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Encrypt All Unencrypted
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
