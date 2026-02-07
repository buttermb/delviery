import { motion } from "framer-motion";
import { TrendingUp, DollarSign, Package, Users, BarChart3, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";

export function AnimatedDashboardPreview() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const stats = [
    { label: "Revenue", value: "$48,574", change: "+12.5%", icon: DollarSign, color: "emerald" },
    { label: "Orders", value: "1,429", change: "+8.2%", icon: Package, color: "blue" },
    { label: "Customers", value: "892", change: "+15.3%", icon: Users, color: "purple" },
    { label: "Growth", value: "23.8%", change: "+5.1%", icon: TrendingUp, color: "orange" },
  ];

  const chartData = [45, 72, 58, 85, 67, 92, 78, 88, 95];

  const containerVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      className="mt-12 rounded-3xl overflow-hidden shadow-2xl border border-white/20 bg-gradient-to-br from-white/95 to-gray-50/95 backdrop-blur-xl"
    >
      <div className="p-8">
        {/* Dashboard Header */}
        <motion.div
          variants={itemVariants}
          className="flex items-center justify-between pb-6 border-b border-gray-200"
        >
          <div className="flex items-center gap-4">
            <motion.div
              className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <BarChart3 className="w-6 h-6 text-white" />
            </motion.div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Analytics Dashboard</h3>
              <p className="text-sm text-gray-500">Real-time insights</p>
            </div>
          </div>
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-shadow"
            >
              Export
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Filter
            </motion.button>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-6"
        >
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            const colorClasses = {
              emerald: "from-emerald-500/10 to-emerald-500/5 text-emerald-600",
              blue: "from-blue-500/10 to-blue-500/5 text-blue-600",
              purple: "from-purple-500/10 to-purple-500/5 text-purple-600",
              orange: "from-orange-500/10 to-orange-500/5 text-orange-600",
            };

            return (
              <motion.div
                key={stat.label}
                variants={itemVariants}
                whileHover={{ y: -4, scale: 1.02 }}
                className="p-5 bg-white rounded-xl shadow-md hover:shadow-xl transition-all cursor-pointer border border-gray-100"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${colorClasses[stat.color as keyof typeof colorClasses]}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={isVisible ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: index * 0.1 + 0.5 }}
                    className="flex items-center gap-1 text-emerald-600 text-sm font-semibold"
                  >
                    <ArrowUpRight className="w-3 h-3" />
                    {stat.change}
                  </motion.div>
                </div>
                <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
                <motion.p
                  className="text-2xl font-bold text-gray-900"
                  initial={{ opacity: 0 }}
                  animate={isVisible ? { opacity: 1 } : {}}
                  transition={{ delay: index * 0.1 + 0.3 }}
                >
                  {stat.value}
                </motion.p>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Animated Chart */}
        <motion.div
          variants={itemVariants}
          className="p-6 bg-white rounded-xl shadow-md border border-gray-100"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-lg font-bold text-gray-900">Sales Overview</h4>
              <p className="text-sm text-gray-500">Last 9 months performance</p>
            </div>
            <div className="flex items-center gap-2 text-emerald-600 font-semibold">
              <TrendingUp className="w-5 h-5" />
              <span>+32.4%</span>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="flex items-end justify-between gap-3 h-48">
            {chartData.map((height, i) => (
              <motion.div
                key={i}
                className="flex-1 relative group cursor-pointer"
                initial={{ height: 0 }}
                animate={isVisible ? { height: `${height}%` } : {}}
                transition={{
                  duration: 0.8,
                  delay: i * 0.1 + 0.5,
                  ease: "easeOut"
                }}
              >
                <motion.div
                  className="w-full h-full bg-gradient-to-t from-emerald-500 via-emerald-400 to-emerald-300 rounded-t-lg shadow-lg"
                  whileHover={{ scale: 1.05, y: -4 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  {/* Tooltip on hover */}
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap shadow-xl">
                    ${(height * 100).toFixed(0)}
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900" />
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>

          {/* Chart Labels */}
          <div className="flex items-center justify-between mt-4 text-xs text-gray-500 font-medium">
            {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"].map((month) => (
              <span key={month}>{month}</span>
            ))}
          </div>
        </motion.div>

        {/* Bottom Stats */}
        <motion.div
          variants={itemVariants}
          className="mt-6 grid grid-cols-3 gap-4"
        >
          <div className="p-4 bg-gradient-to-br from-emerald-50 to-white rounded-xl border border-emerald-100">
            <p className="text-sm text-gray-600 mb-1">Conversion Rate</p>
            <p className="text-xl font-bold text-emerald-600">4.8%</p>
          </div>
          <div className="p-4 bg-gradient-to-br from-blue-50 to-white rounded-xl border border-blue-100">
            <p className="text-sm text-gray-600 mb-1">Avg. Order Value</p>
            <p className="text-xl font-bold text-blue-600">$156</p>
          </div>
          <div className="p-4 bg-gradient-to-br from-purple-50 to-white rounded-xl border border-purple-100">
            <p className="text-sm text-gray-600 mb-1">Active Users</p>
            <p className="text-xl font-bold text-purple-600">2,841</p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
