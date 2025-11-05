import { ShoppingCart, Package, Warehouse, Users, BarChart3, TrendingUp, TrendingDown, AlertCircle, Clock, MapPin, DollarSign, Star, ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { mockDashboardData } from '../mockDashboardData';

export const dashboardViews = {
  dashboard: {
    title: 'Dashboard Overview',
    description: 'Real-time metrics and analytics',
  },
  catalog: {
    title: 'Product Catalog',
    description: 'Manage your product inventory',
    preview: (
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {mockDashboardData.topProducts.slice(0, 4).map((product, i) => (
          <motion.div
            key={product.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-2 bg-muted/30 rounded border border-border/30"
          >
            <div className="flex gap-2">
              <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded flex items-center justify-center flex-shrink-0">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1">
                    <div className="text-xs font-semibold truncate">{product.name}</div>
                    <div className="text-[10px] text-muted-foreground">SKU: PRD-{product.rank}00{i}</div>
                  </div>
                  {product.trend.includes('+') ? (
                    <TrendingUp className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-orange-600 flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3 text-muted-foreground" />
                    <span className="font-semibold">${Number(product.revenue).toLocaleString()}</span>
                  </div>
                  <div className="text-muted-foreground">{product.quantity} sold</div>
                </div>
                <div className="mt-1.5">
                  <Progress value={Math.min((product.orders / 20) * 100, 100)} className="h-1" />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    ),
  },
  orders: {
    title: 'Order Management',
    description: 'Track and fulfill customer orders',
    preview: (
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {mockDashboardData.pendingTransfers.slice(0, 4).map((order, i) => (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-2 bg-muted/30 rounded border border-border/30"
          >
            <div className="flex items-start gap-2 mb-2">
              <div className="w-10 h-10 bg-emerald-500/20 rounded flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold">Order #{order.id}</div>
                    <div className="text-[10px] text-muted-foreground">{order.customer}</div>
                  </div>
                  <Badge 
                    variant={order.status === 'On Time' ? 'default' : 'secondary'} 
                    className="text-[10px] bg-emerald-600 flex-shrink-0"
                  >
                    {order.status}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground ml-12">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{order.time}</span>
              </div>
              <div className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                <span>{order.weight}</span>
              </div>
              <div className="flex items-center gap-1 font-semibold text-foreground">
                <DollarSign className="h-3 w-3" />
                <span>{order.value}</span>
              </div>
            </div>
            <div className="mt-1.5 ml-12">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${order.status === 'On Time' ? 75 : 40}%` }}
                    transition={{ delay: i * 0.1 + 0.2, duration: 0.6 }}
                    className="h-full bg-emerald-600"
                  />
                </div>
                <div className="text-[9px] text-muted-foreground">
                  {order.status === 'On Time' ? 'In Transit' : 'Processing'}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    ),
  },
  inventory: {
    title: 'Inventory Control',
    description: 'Monitor stock levels and locations',
    preview: (
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {mockDashboardData.inventoryAlerts.map((item, i) => (
          <motion.div
            key={item.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-2 bg-muted/30 rounded border border-border/30"
          >
            <div className="flex items-start gap-2 mb-2">
              {item.urgency === 'critical' && (
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              )}
              {item.urgency === 'warning' && (
                <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
              )}
              {item.urgency === 'low' && (
                <Warehouse className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="text-xs font-semibold truncate">{item.name}</div>
                  <Badge 
                    variant={item.urgency === 'critical' ? 'destructive' : 'outline'} 
                    className="text-[10px] flex-shrink-0"
                  >
                    {item.current}/{item.threshold}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1.5">
                  <MapPin className="h-3 w-3" />
                  <span>{item.location}</span>
                </div>
                <div className="space-y-1">
                  <Progress 
                    value={(item.current / item.threshold) * 100} 
                    className="h-1.5"
                  />
                  <div className="text-[9px] text-muted-foreground">
                    {item.urgency === 'critical' && 'Critical - Restock immediately'}
                    {item.urgency === 'warning' && 'Low stock - Restock soon'}
                    {item.urgency === 'low' && 'Adequate stock'}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    ),
  },
  customers: {
    title: 'Customer Directory',
    description: 'Manage customer relationships',
    preview: (
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {['Premium Dispensary Co.', 'Green Valley Retail', 'Urban Wellness', 'Coastal Cannabis'].map((name, i) => {
          const orders = [24, 18, 31, 12][i];
          const ltv = [45600, 32400, 58900, 21800][i];
          const tier = orders > 20 ? 'VIP' : orders > 15 ? 'Premium' : 'Regular';
          const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2);
          const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-500'];
          
          return (
            <motion.div
              key={name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-2 bg-muted/30 rounded border border-border/30"
            >
              <div className="flex items-start gap-2">
                <div className={`w-10 h-10 ${colors[i]}/20 rounded-full flex items-center justify-center flex-shrink-0`}>
                  <span className={`text-xs font-bold ${colors[i].replace('bg-', 'text-')}`}>
                    {initials}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="text-xs font-semibold truncate">{name}</div>
                    <Badge 
                      variant={tier === 'VIP' ? 'default' : 'secondary'} 
                      className="text-[10px] flex-shrink-0"
                    >
                      {tier}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] mb-1">
                    <div>
                      <div className="text-muted-foreground">Orders</div>
                      <div className="font-semibold flex items-center gap-0.5">
                        <ShoppingCart className="h-3 w-3" />
                        {orders}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Lifetime Value</div>
                      <div className="font-semibold flex items-center gap-0.5">
                        <DollarSign className="h-3 w-3" />
                        {(ltv / 1000).toFixed(1)}k
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Last order {i + 1} days ago</span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    ),
  },
  analytics: {
    title: 'Analytics & Reports',
    description: 'Deep insights into your business',
    preview: (
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Revenue', value: '$124.5k', change: '+12.5%', trend: 'up' },
            { label: 'Orders', value: '1,429', change: '+8.2%', trend: 'up' },
          ].map((metric, i) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="p-2 bg-muted/30 rounded border border-border/30"
            >
              <div className="text-[10px] text-muted-foreground mb-0.5">{metric.label}</div>
              <div className="text-sm font-bold mb-0.5">{metric.value}</div>
              <div className="flex items-center gap-1 text-[10px] text-emerald-600">
                {metric.trend === 'up' ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>{metric.change}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Mini Sales Chart */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-2 bg-muted/30 rounded border border-border/30"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold">Sales Trend</div>
            <Badge variant="secondary" className="text-[10px]">Last 7 days</Badge>
          </div>
          <div className="flex items-end justify-between gap-1 h-16">
            {mockDashboardData.salesChart.slice(0, 7).map((day, i) => {
              const maxAmount = Math.max(...mockDashboardData.salesChart.map(d => d.amount));
              const height = (day.amount / maxAmount) * 100;
              return (
                <motion.div
                  key={day.day}
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ delay: 0.3 + i * 0.05, duration: 0.3 }}
                  className="flex-1 bg-primary rounded-t"
                />
              );
            })}
          </div>
        </motion.div>

        {/* Category Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="p-2 bg-muted/30 rounded border border-border/30"
        >
          <div className="text-xs font-semibold mb-2">Top Categories</div>
          <div className="space-y-1.5">
            {mockDashboardData.categoryBreakdown.slice(0, 3).map((cat, i) => (
              <div key={cat.name}>
                <div className="flex items-center justify-between text-[10px] mb-0.5">
                  <span className="text-muted-foreground">{cat.name}</span>
                  <span className="font-semibold">{cat.percentage}%</span>
                </div>
                <Progress value={cat.percentage} className="h-1" />
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    ),
  },
};

export type DashboardViewKey = keyof typeof dashboardViews;
