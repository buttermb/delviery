/**
 * Simple Revenue Prediction using Linear Regression
 * Lightweight ML model for forecasting revenue based on historical data
 */

export interface HistoricalData {
  date: string;
  revenue: number;
  orders?: number;
  customers?: number;
  avgOrderValue?: number;
}

export interface PredictionResult {
  date: string;
  predictedRevenue: number;
  trend: 'up' | 'down' | 'stable';
  confidence: number;
}

export interface WeekPrediction {
  predictions: PredictionResult[];
  totalPredicted: number;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
}

export class SimpleRevenuePredictor {
  private historicalData: HistoricalData[] = [];

  /**
   * Calculate linear regression from historical data
   * Returns slope and intercept for y = mx + b
   */
  private linearRegression(data: HistoricalData[]): { slope: number; intercept: number } {
    if (data.length < 2) {
      return { slope: 0, intercept: data[0]?.revenue ?? 0 };
    }

    const n = data.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    data.forEach((point, index) => {
      const x = index;
      const y = point.revenue;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  /**
   * Predict revenue for a specific number of days ahead
   */
  predict(historicalData: HistoricalData[], daysAhead: number): number {
    if (historicalData.length === 0) return 0;
    if (historicalData.length === 1) return historicalData[0].revenue;

    const { slope, intercept } = this.linearRegression(historicalData);
    const x = historicalData.length + daysAhead - 1;
    const predicted = slope * x + intercept;

    // Ensure non-negative predictions
    return Math.max(0, predicted);
  }

  /**
   * Predict next 7 days with trend analysis
   */
  predictWeek(historicalData: HistoricalData[]): WeekPrediction {
    this.historicalData = historicalData;

    if (historicalData.length === 0) {
      return {
        predictions: [],
        totalPredicted: 0,
        confidence: 0,
        trend: 'stable',
      };
    }

    const predictions: PredictionResult[] = [];
    const { slope } = this.linearRegression(historicalData);
    const confidence = this.calculateConfidence(historicalData);
    const trend = this.determineTrend(slope);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 1; i <= 7; i++) {
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + i);

      const predictedRevenue = this.predict(historicalData, i);
      
      // Apply weekend adjustment
      const dayOfWeek = futureDate.getDay();
      const weekendMultiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 0.7 : 1.0;
      const adjustedRevenue = predictedRevenue * weekendMultiplier;

      // Determine individual day trend (can differ from overall trend)
      const dayTrend = slope > 50 ? 'up' : slope < -50 ? 'down' : 'stable';

      predictions.push({
        date: futureDate.toISOString().split('T')[0],
        predictedRevenue: Math.round(adjustedRevenue),
        trend: dayTrend,
        confidence,
      });
    }

    const totalPredicted = predictions.reduce((sum, p) => sum + p.predictedRevenue, 0);

    return {
      predictions,
      totalPredicted,
      confidence,
      trend,
    };
  }

  /**
   * Calculate confidence level based on data volume and consistency
   */
  calculateConfidence(historicalData: HistoricalData[]): number {
    if (historicalData.length < 7) return 0.3; // Low confidence
    if (historicalData.length < 30) return 0.6; // Medium confidence
    if (historicalData.length < 60) return 0.8; // Good confidence
    return 0.85; // High confidence (90+ days)
  }

  /**
   * Determine overall trend from slope
   */
  private determineTrend(slope: number): 'up' | 'down' | 'stable' {
    if (slope > 100) return 'up';
    if (slope < -100) return 'down';
    return 'stable';
  }

  /**
   * Get trend description for UI display
   */
  getTrendDescription(trend: 'up' | 'down' | 'stable'): string {
    switch (trend) {
      case 'up':
        return 'Revenue trending upward';
      case 'down':
        return 'Revenue trending downward';
      default:
        return 'Revenue stable';
    }
  }

  /**
   * Get confidence description for UI display
   */
  getConfidenceDescription(confidence: number): string {
    if (confidence < 0.5) {
      return '⚠️ Low confidence: Need more historical data for accurate predictions';
    }
    if (confidence < 0.75) {
      return 'ℹ️ Medium confidence: Predictions based on recent trends';
    }
    return '✅ High confidence: Predictions based on 30+ days of data';
  }
}

