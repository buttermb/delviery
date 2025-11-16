/**
 * Revenue Predictor
 * Simple linear regression-based revenue prediction
 * Can be enhanced with TensorFlow.js for advanced ML models
 */

export interface HistoricalData {
  date: string;
  revenue: number;
}

export class SimpleRevenuePredictor {
  /**
   * Calculate linear regression
   */
  private linearRegression(data: HistoricalData[]) {
    const n = data.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    data.forEach((point, index) => {
      sumX += index;
      sumY += point.revenue;
      sumXY += index * point.revenue;
      sumX2 += index * index;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  /**
   * Predict future revenue
   */
  predict(historicalData: HistoricalData[], daysAhead: number): number {
    if (historicalData.length < 2) {
      // Not enough data, return average
      const avg = historicalData.reduce((sum, d) => sum + d.revenue, 0) / historicalData.length;
      return avg;
    }

    const { slope, intercept } = this.linearRegression(historicalData);
    const x = historicalData.length + daysAhead;
    return Math.max(0, slope * x + intercept); // Ensure non-negative
  }

  /**
   * Predict next 7 days
   */
  predictWeek(historicalData: HistoricalData[]): Array<{
    date: string;
    predictedRevenue: number;
    trend: 'up' | 'down' | 'stable';
  }> {
    const predictions = [];
    const { slope } = historicalData.length >= 2 
      ? this.linearRegression(historicalData)
      : { slope: 0 };

    const today = new Date();

    for (let i = 1; i <= 7; i++) {
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + i);

      const predicted = this.predict(historicalData, i);

      predictions.push({
        date: futureDate.toISOString().split('T')[0],
        predictedRevenue: Math.round(Math.max(0, predicted)),
        trend: slope > 100 ? 'up' : slope < -100 ? 'down' : 'stable',
      });
    }

    return predictions;
  }

  /**
   * Calculate confidence level based on data quality
   */
  calculateConfidence(historicalData: HistoricalData[]): number {
    if (historicalData.length < 7) return 0.3; // Low confidence
    if (historicalData.length < 30) return 0.6; // Medium confidence
    return 0.85; // High confidence
  }
}

