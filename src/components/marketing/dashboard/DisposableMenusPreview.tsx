import { motion } from 'framer-motion';
import Shield from "lucide-react/dist/esm/icons/shield";
import Eye from "lucide-react/dist/esm/icons/eye";
import QrCode from "lucide-react/dist/esm/icons/qr-code";
import Clock from "lucide-react/dist/esm/icons/clock";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import Lock from "lucide-react/dist/esm/icons/lock";
import Copy from "lucide-react/dist/esm/icons/copy";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const activeMenus = [
  {
    id: 'M-A4F8',
    name: 'Spring 2024 Cannabis',
    status: 'active',
    views: 234,
    uniqueVisitors: 89,
    accessCode: 'AC-****-23',
    expiresIn: '2 days 14h',
    trend: '+12%'
  },
  {
    id: 'M-B9E2',
    name: 'Premium Strains Menu',
    status: 'expiring',
    views: 156,
    uniqueVisitors: 62,
    accessCode: 'AC-****-7F',
    expiresIn: '6 hours',
    trend: '+8%'
  },
  {
    id: 'M-C3D1',
    name: 'Bulk Orders Special',
    status: 'active',
    views: 89,
    uniqueVisitors: 34,
    accessCode: 'AC-****-5A',
    expiresIn: '5 days 3h',
    trend: '+24%'
  }
];

const viewPatternData = [
  { hour: '9am', intensity: 40 },
  { hour: '12pm', intensity: 70 },
  { hour: '3pm', intensity: 90 },
  { hour: '6pm', intensity: 60 },
  { hour: '9pm', intensity: 30 }
];

export function DisposableMenusPreview() {
  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
      {/* Security Status Banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-2 bg-primary/10 rounded border border-primary/30 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ repeat: Infinity, duration: 3 }}
          >
            <Shield className="h-4 w-4 text-primary" />
          </motion.div>
          <span className="text-xs font-semibold text-primary">AES-256 ENCRYPTED</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Lock className="h-3 w-3" />
          <span>Bank-Level Security</span>
        </div>
      </motion.div>

      {/* Active Menus */}
      <div className="space-y-2">
        {activeMenus.map((menu, i) => (
          <motion.div
            key={menu.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-2 bg-muted/30 rounded border border-border/30"
          >
            <div className="flex items-start gap-2">
              <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded flex items-center justify-center flex-shrink-0">
                <QrCode className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1">
                    <div className="text-xs font-semibold truncate">{menu.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{menu.id}</div>
                  </div>
                  <Badge 
                    variant={menu.status === 'active' ? 'default' : 'destructive'}
                    className="text-[10px] flex-shrink-0"
                  >
                    {menu.status === 'active' ? 'Active' : 'Expiring Soon'}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-1.5">
                  <div>
                    <div className="text-[9px] text-muted-foreground">Total Views</div>
                    <div className="text-xs font-semibold flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {menu.views}
                      <span className="text-[9px] text-emerald-600">{menu.trend}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-muted-foreground">Unique Visitors</div>
                    <div className="text-xs font-semibold">{menu.uniqueVisitors}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Expires in {menu.expiresIn}</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-primary">
                    <Lock className="h-3 w-3" />
                    <span>{menu.accessCode}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Viewing Pattern Heatmap */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="p-2 bg-muted/20 rounded border border-border/20"
      >
        <div className="text-xs font-semibold mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-primary" />
            Peak Viewing Hours
          </div>
          <Badge variant="secondary" className="text-[10px]">Today</Badge>
        </div>
        
        <div className="flex items-end justify-between gap-1 h-16">
          {viewPatternData.map((data, i) => (
            <div key={data.hour} className="flex-1 flex flex-col items-center gap-1">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${data.intensity}%` }}
                transition={{ delay: 0.4 + i * 0.1, duration: 0.4 }}
                className="w-full rounded-t"
                style={{
                  backgroundColor: `hsl(var(--primary) / ${data.intensity / 100})`
                }}
              />
              <div className="text-[9px] text-muted-foreground">{data.hour}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Security Features */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="p-2 bg-muted/20 rounded border border-border/20"
      >
        <div className="text-xs font-semibold mb-2">Security Metrics</div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Total Access Attempts</span>
            <span className="font-semibold">479</span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-orange-500" />
              Failed Attempts
            </span>
            <span className="font-semibold text-orange-500">3</span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Active Tokens</span>
            <span className="font-semibold text-emerald-600">185</span>
          </div>
          <Progress value={97} className="h-1.5 mt-1" />
          <div className="text-[9px] text-muted-foreground text-center">
            97% successful authentication rate
          </div>
        </div>
      </motion.div>
    </div>
  );
}
