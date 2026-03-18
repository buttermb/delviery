/**
 * Expansion Analysis Page
 * 
 * Market opportunity assessment and ROI analysis for business expansion
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Globe, MapPin, TrendingUp, DollarSign, Users, Calculator, AlertCircle } from 'lucide-react';

export default function ExpansionAnalysisPage() {
    return (
        <div className="space-y-4">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <Globe className="h-8 w-8" />
                    Expansion Analysis
                </h1>
                <p className="text-muted-foreground mt-1">Market opportunity assessment and growth planning</p>
            </div>

            {/* ROI Calculator */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calculator className="h-5 w-5" />
                        ROI Calculator
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Initial Investment</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="number"
                                    placeholder="50000"
                                    className="w-full pl-10 pr-3 py-2 border rounded-md"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Expected Monthly Revenue</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="number"
                                    placeholder="15000"
                                    className="w-full pl-10 pr-3 py-2 border rounded-md"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Monthly Operating Costs</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="number"
                                    placeholder="8000"
                                    className="w-full pl-10 pr-3 py-2 border rounded-md"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                        <div className="grid gap-2 md:grid-cols-3">
                            <div>
                                <p className="text-sm text-muted-foreground">Monthly Profit</p>
                                <p className="text-2xl font-bold text-green-600">$7,000</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Break-even Period</p>
                                <p className="text-2xl font-bold">7.1 months</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">12-Month ROI</p>
                                <p className="text-2xl font-bold text-primary">68%</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Market Opportunities */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        Market Opportunities
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-start justify-between p-4 border rounded-lg hover:shadow-md transition-shadow">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold">New Location - Downtown District</h4>
                                <Badge variant="secondary">High Potential</Badge>
                            </div>
                            <div className="grid gap-2 text-sm text-muted-foreground">
                                <p><strong>Population:</strong> 50,000+</p>
                                <p><strong>Avg. Income:</strong> $75,000</p>
                                <p><strong>Competition:</strong> Medium</p>
                                <p><strong>Est. Monthly Revenue:</strong> $18,000</p>
                            </div>
                        </div>
                        <Button variant="outline">
                            Analyze
                        </Button>
                    </div>

                    <div className="flex items-start justify-between p-4 border rounded-lg hover:shadow-md transition-shadow">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold">Online Expansion</h4>
                                <Badge>Recommended</Badge>
                            </div>
                            <div className="grid gap-2 text-sm text-muted-foreground">
                                <p><strong>Market Size:</strong> Regional (500k+)</p>
                                <p><strong>Initial Investment:</strong> $25,000</p>
                                <p><strong>Competition:</strong> Low</p>
                                <p><strong>Est. Monthly Revenue:</strong> $12,000</p>
                            </div>
                        </div>
                        <Button variant="outline">
                            Analyze
                        </Button>
                    </div>

                    <div className="flex items-start justify-between p-4 border rounded-lg hover:shadow-md transition-shadow opacity-60">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold">Suburban Location</h4>
                                <Badge variant="outline">Moderate Potential</Badge>
                            </div>
                            <div className="grid gap-2 text-sm text-muted-foreground">
                                <p><strong>Population:</strong> 25,000+</p>
                                <p><strong>Avg. Income:</strong> $65,000</p>
                                <p><strong>Competition:</strong> High</p>
                                <p><strong>Est. Monthly Revenue:</strong> $10,000</p>
                            </div>
                        </div>
                        <Button variant="outline">
                            Analyze
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Key Considerations */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        Key Considerations
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <Users className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                            <h4 className="font-medium text-blue-900 dark:text-blue-100">Market Demand</h4>
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                Analyze customer demographics and purchasing power in target areas.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <DollarSign className="h-5 w-5 text-amber-600 mt-0.5" />
                        <div>
                            <h4 className="font-medium text-amber-900 dark:text-amber-100">Capital Requirements</h4>
                            <p className="text-sm text-amber-800 dark:text-amber-200">
                                Ensure adequate funding for initial setup, inventory, and 3-6 months operating costs.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                        <div>
                            <h4 className="font-medium text-green-900 dark:text-green-100">Growth Potential</h4>
                            <p className="text-sm text-green-800 dark:text-green-200">
                                Evaluate long-term market trends and sustainability of the expansion opportunity.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Action Plan */}
            <Card>
                <CardHeader>
                    <CardTitle>Next Steps</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                                1
                            </div>
                            <span className="font-medium">Conduct market research</span>
                        </div>
                        <Badge variant="outline">Not Started</Badge>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                                2
                            </div>
                            <span className="font-medium">Secure funding and permits</span>
                        </div>
                        <Badge variant="outline">Not Started</Badge>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                                3
                            </div>
                            <span className="font-medium">Finalize location and staffing</span>
                        </div>
                        <Badge variant="outline">Not Started</Badge>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
