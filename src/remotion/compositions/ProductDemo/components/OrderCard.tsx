import { COLORS } from '../../../config';
import { useSlideIn } from '../../../utils/animations';

interface OrderCardProps {
  orderId: string;
  customer: string;
  amount: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
  delay?: number;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#fef3c7', text: '#92400e' },
  processing: { bg: '#dbeafe', text: '#1e40af' },
  shipped: { bg: '#e0e7ff', text: '#3730a3' },
  delivered: { bg: '#d1fae5', text: '#065f46' },
};

export function OrderCard({ orderId, customer, amount, status, delay = 0 }: OrderCardProps) {
  const style = useSlideIn(delay, 'up', 'snappy');
  const colors = STATUS_COLORS[status];

  return (
    <div
      style={{
        ...style,
        background: COLORS.background,
        borderRadius: 10,
        padding: '14px 16px',
        border: `1px solid ${COLORS.border}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        width: 260,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: COLORS.text,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          #{orderId}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: colors.text,
            background: colors.bg,
            padding: '2px 10px',
            borderRadius: 12,
            fontFamily: 'Inter, sans-serif',
            textTransform: 'capitalize',
          }}
        >
          {status}
        </span>
      </div>
      <div
        style={{
          fontSize: 13,
          color: COLORS.textLight,
          fontFamily: 'Inter, sans-serif',
          marginBottom: 4,
        }}
      >
        {customer}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: COLORS.text,
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {amount}
      </div>
    </div>
  );
}
