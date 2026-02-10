/**
 * OrderPrintView - Print layouts for orders
 * Supports thermal receipt (58mm/80mm) and packing slip formats
 */

import { forwardRef } from 'react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils';

export interface OrderPrintItem {
  product_name: string;
  quantity: number;
  price: number;
  sku?: string;
  notes?: string;
}

export interface OrderPrintData {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  total_amount: number;
  subtotal?: number;
  tax_amount?: number;
  discount_amount?: number;
  delivery_fee?: number;
  delivery_method?: string;
  payment_method?: string;
  payment_status?: string;
  notes?: string;
  customer: {
    name: string;
    email?: string;
    phone?: string;
  };
  delivery_address?: {
    street: string;
    city?: string;
    state?: string;
    zip_code?: string;
  };
  items: OrderPrintItem[];
  business?: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    license?: string;
  };
}

export type PrintLayout = 'thermal-58mm' | 'thermal-80mm' | 'packing-slip';

interface OrderPrintViewProps {
  order: OrderPrintData;
  layout: PrintLayout;
  showPrices?: boolean;
  className?: string;
}

/**
 * Thermal Receipt Layout - 58mm or 80mm width
 * Optimized for thermal receipt printers
 */
function ThermalReceiptLayout({
  order,
  width,
  showPrices = true,
}: {
  order: OrderPrintData;
  width: '58mm' | '80mm';
  showPrices?: boolean;
}) {
  const is58mm = width === '58mm';
  const charWidth = is58mm ? 32 : 42;

  const formatLine = (left: string, right: string) => {
    const spaces = Math.max(1, charWidth - left.length - right.length);
    return left + ' '.repeat(spaces) + right;
  };

  const divider = '='.repeat(charWidth);
  const thinDivider = '-'.repeat(charWidth);

  return (
    <div
      className={cn(
        'font-mono text-black bg-white',
        is58mm ? 'text-[10px] leading-tight' : 'text-xs leading-tight'
      )}
      style={{
        width: width,
        padding: '4mm',
        fontFamily: 'monospace',
      }}
    >
      {/* Header */}
      {order.business && (
        <div className="text-center mb-2">
          <div className="font-bold text-sm">{order.business.name}</div>
          {order.business.address && (
            <div className="text-[9px]">{order.business.address}</div>
          )}
          {order.business.phone && (
            <div className="text-[9px]">Tel: {order.business.phone}</div>
          )}
          {order.business.license && (
            <div className="text-[9px]">License: {order.business.license}</div>
          )}
        </div>
      )}

      <pre className="whitespace-pre-wrap">{divider}</pre>

      {/* Order Info */}
      <div className="text-center font-bold my-1">
        ORDER #{order.order_number}
      </div>
      <pre className="whitespace-pre-wrap">{thinDivider}</pre>

      <div className="my-1">
        <pre className="whitespace-pre-wrap">
          {formatLine('Date:', format(new Date(order.created_at), 'MM/dd/yy HH:mm'))}
        </pre>
        <pre className="whitespace-pre-wrap">
          {formatLine('Status:', order.status.toUpperCase())}
        </pre>
        {order.payment_method && (
          <pre className="whitespace-pre-wrap">
            {formatLine('Payment:', order.payment_method)}
          </pre>
        )}
      </div>

      <pre className="whitespace-pre-wrap">{thinDivider}</pre>

      {/* Customer Info */}
      <div className="my-1">
        <div className="font-bold">Customer:</div>
        <div>{order.customer.name}</div>
        {order.customer.phone && <div>{order.customer.phone}</div>}
      </div>

      {/* Delivery Address */}
      {order.delivery_address && (
        <>
          <pre className="whitespace-pre-wrap">{thinDivider}</pre>
          <div className="my-1">
            <div className="font-bold">Delivery:</div>
            <div>{order.delivery_address.street}</div>
            {order.delivery_address.city && (
              <div>
                {order.delivery_address.city}
                {order.delivery_address.state && `, ${order.delivery_address.state}`}
                {order.delivery_address.zip_code && ` ${order.delivery_address.zip_code}`}
              </div>
            )}
          </div>
        </>
      )}

      <pre className="whitespace-pre-wrap">{divider}</pre>

      {/* Order Items */}
      <div className="my-1">
        <div className="font-bold mb-1">Items:</div>
        {order.items.map((item, index) => (
          <div key={index} className="mb-1">
            <div className="truncate">
              {item.quantity}x {item.product_name}
            </div>
            {showPrices && (
              <pre className="whitespace-pre-wrap">
                {formatLine(
                  `   @ ${formatCurrency(item.price)}`,
                  formatCurrency(item.quantity * item.price)
                )}
              </pre>
            )}
            {item.notes && (
              <div className="text-[9px] pl-3 italic">* {item.notes}</div>
            )}
          </div>
        ))}
      </div>

      <pre className="whitespace-pre-wrap">{divider}</pre>

      {/* Totals */}
      {showPrices && (
        <div className="my-1">
          {order.subtotal !== undefined && (
            <pre className="whitespace-pre-wrap">
              {formatLine('Subtotal:', formatCurrency(order.subtotal))}
            </pre>
          )}
          {order.discount_amount !== undefined && order.discount_amount > 0 && (
            <pre className="whitespace-pre-wrap">
              {formatLine('Discount:', `-${formatCurrency(order.discount_amount)}`)}
            </pre>
          )}
          {order.tax_amount !== undefined && (
            <pre className="whitespace-pre-wrap">
              {formatLine('Tax:', formatCurrency(order.tax_amount))}
            </pre>
          )}
          {order.delivery_fee !== undefined && order.delivery_fee > 0 && (
            <pre className="whitespace-pre-wrap">
              {formatLine('Delivery:', formatCurrency(order.delivery_fee))}
            </pre>
          )}
          <pre className="whitespace-pre-wrap">{thinDivider}</pre>
          <pre className="whitespace-pre-wrap font-bold text-sm">
            {formatLine('TOTAL:', formatCurrency(order.total_amount))}
          </pre>
        </div>
      )}

      {/* Order Notes */}
      {order.notes && (
        <>
          <pre className="whitespace-pre-wrap">{thinDivider}</pre>
          <div className="my-1">
            <div className="font-bold">Notes:</div>
            <div className="text-[9px]">{order.notes}</div>
          </div>
        </>
      )}

      <pre className="whitespace-pre-wrap">{divider}</pre>

      {/* Footer */}
      <div className="text-center mt-2 text-[9px]">
        <div>Thank you for your order!</div>
        <div className="mt-1">
          {format(new Date(), 'MM/dd/yyyy HH:mm:ss')}
        </div>
      </div>
    </div>
  );
}

/**
 * Packing Slip Layout - Full page format
 * For warehouse/fulfillment use
 */
function PackingSlipLayout({
  order,
  showPrices = false,
}: {
  order: OrderPrintData;
  showPrices?: boolean;
}) {
  return (
    <div
      className="font-sans text-black bg-white p-8"
      style={{
        width: '8.5in',
        minHeight: '11in',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
        <div>
          {order.business && (
            <>
              <h1 className="text-2xl font-bold">{order.business.name}</h1>
              {order.business.address && (
                <p className="text-sm text-gray-600">{order.business.address}</p>
              )}
              {order.business.phone && (
                <p className="text-sm text-gray-600">Tel: {order.business.phone}</p>
              )}
              {order.business.license && (
                <p className="text-sm text-gray-600">License: {order.business.license}</p>
              )}
            </>
          )}
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-bold tracking-tight">PACKING SLIP</h2>
          <p className="text-lg font-mono mt-1">#{order.order_number}</p>
          <p className="text-sm text-gray-600 mt-1">
            {format(new Date(order.created_at), 'MMMM d, yyyy')}
          </p>
        </div>
      </div>

      {/* Customer & Shipping Info */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div className="border border-gray-300 p-4 rounded">
          <h3 className="font-bold text-sm uppercase text-gray-500 mb-2">Ship To</h3>
          <div className="text-base">
            <p className="font-semibold">{order.customer.name}</p>
            {order.delivery_address && (
              <>
                <p>{order.delivery_address.street}</p>
                <p>
                  {order.delivery_address.city}
                  {order.delivery_address.state && `, ${order.delivery_address.state}`}
                  {order.delivery_address.zip_code && ` ${order.delivery_address.zip_code}`}
                </p>
              </>
            )}
            {order.customer.phone && <p className="mt-2">{order.customer.phone}</p>}
            {order.customer.email && (
              <p className="text-sm text-gray-600">{order.customer.email}</p>
            )}
          </div>
        </div>

        <div className="border border-gray-300 p-4 rounded">
          <h3 className="font-bold text-sm uppercase text-gray-500 mb-2">Order Info</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Order Date:</span>
              <span className="font-medium">
                {format(new Date(order.created_at), 'MM/dd/yyyy')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className="font-medium uppercase">{order.status}</span>
            </div>
            {order.delivery_method && (
              <div className="flex justify-between">
                <span className="text-gray-600">Shipping:</span>
                <span className="font-medium capitalize">{order.delivery_method}</span>
              </div>
            )}
            {order.payment_status && (
              <div className="flex justify-between">
                <span className="text-gray-600">Payment:</span>
                <span className="font-medium capitalize">{order.payment_status}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full border-collapse mb-8">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 p-3 text-left font-semibold">Item</th>
            <th className="border border-gray-300 p-3 text-left font-semibold w-24">SKU</th>
            <th className="border border-gray-300 p-3 text-center font-semibold w-20">Qty</th>
            <th className="border border-gray-300 p-3 text-center font-semibold w-20">Packed</th>
            {showPrices && (
              <>
                <th className="border border-gray-300 p-3 text-right font-semibold w-24">Price</th>
                <th className="border border-gray-300 p-3 text-right font-semibold w-24">Total</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, index) => (
            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="border border-gray-300 p-3">
                <div className="font-medium">{item.product_name}</div>
                {item.notes && (
                  <div className="text-sm text-gray-500 italic mt-1">
                    Note: {item.notes}
                  </div>
                )}
              </td>
              <td className="border border-gray-300 p-3 font-mono text-sm">
                {item.sku || '-'}
              </td>
              <td className="border border-gray-300 p-3 text-center font-semibold text-lg">
                {item.quantity}
              </td>
              <td className="border border-gray-300 p-3 text-center">
                <div className="w-6 h-6 border-2 border-gray-400 mx-auto" />
              </td>
              {showPrices && (
                <>
                  <td className="border border-gray-300 p-3 text-right font-mono">
                    {formatCurrency(item.price)}
                  </td>
                  <td className="border border-gray-300 p-3 text-right font-mono">
                    {formatCurrency(item.quantity * item.price)}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
        {showPrices && (
          <tfoot>
            <tr className="bg-gray-100">
              <td
                colSpan={4}
                className="border border-gray-300 p-3 text-right font-semibold"
              >
                Subtotal:
              </td>
              <td
                colSpan={2}
                className="border border-gray-300 p-3 text-right font-mono"
              >
                {formatCurrency(order.subtotal || order.total_amount)}
              </td>
            </tr>
            {order.discount_amount !== undefined && order.discount_amount > 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="border border-gray-300 p-3 text-right"
                >
                  Discount:
                </td>
                <td
                  colSpan={2}
                  className="border border-gray-300 p-3 text-right font-mono text-red-600"
                >
                  -{formatCurrency(order.discount_amount)}
                </td>
              </tr>
            )}
            {order.tax_amount !== undefined && (
              <tr>
                <td
                  colSpan={4}
                  className="border border-gray-300 p-3 text-right"
                >
                  Tax:
                </td>
                <td
                  colSpan={2}
                  className="border border-gray-300 p-3 text-right font-mono"
                >
                  {formatCurrency(order.tax_amount)}
                </td>
              </tr>
            )}
            {order.delivery_fee !== undefined && order.delivery_fee > 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="border border-gray-300 p-3 text-right"
                >
                  Delivery:
                </td>
                <td
                  colSpan={2}
                  className="border border-gray-300 p-3 text-right font-mono"
                >
                  {formatCurrency(order.delivery_fee)}
                </td>
              </tr>
            )}
            <tr className="bg-gray-200">
              <td
                colSpan={4}
                className="border border-gray-300 p-3 text-right font-bold text-lg"
              >
                Total:
              </td>
              <td
                colSpan={2}
                className="border border-gray-300 p-3 text-right font-mono font-bold text-lg"
              >
                {formatCurrency(order.total_amount)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>

      {/* Summary */}
      <div className="flex justify-between items-start mb-8">
        <div className="flex-1 mr-8">
          <h3 className="font-bold text-sm uppercase text-gray-500 mb-2">
            Packing Summary
          </h3>
          <div className="text-sm space-y-1">
            <p>
              <span className="font-semibold">{order.items.length}</span> line item(s)
            </p>
            <p>
              <span className="font-semibold">
                {order.items.reduce((sum, item) => sum + item.quantity, 0)}
              </span>{' '}
              total unit(s)
            </p>
          </div>
        </div>

        {/* Signature Area */}
        <div className="w-64 border border-gray-300 p-4 rounded">
          <h3 className="font-bold text-sm uppercase text-gray-500 mb-2">
            Packed By
          </h3>
          <div className="border-b border-gray-400 h-8 mb-2" />
          <p className="text-xs text-gray-500">Signature / Initials</p>
          <div className="mt-2">
            <p className="text-xs text-gray-500">Date: _______________</p>
          </div>
        </div>
      </div>

      {/* Notes Section */}
      {order.notes && (
        <div className="border border-gray-300 p-4 rounded mb-8">
          <h3 className="font-bold text-sm uppercase text-gray-500 mb-2">
            Order Notes
          </h3>
          <p className="text-sm">{order.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div className="border-t-2 border-gray-300 pt-4 mt-auto text-center text-sm text-gray-500">
        <p>
          Printed: {format(new Date(), 'MMMM d, yyyy h:mm a')} | Order #{order.order_number}
        </p>
      </div>
    </div>
  );
}

/**
 * Main OrderPrintView component
 * Renders the appropriate layout based on the layout prop
 */
export const OrderPrintView = forwardRef<HTMLDivElement, OrderPrintViewProps>(
  function OrderPrintView({ order, layout, showPrices = true, className }, ref) {
    return (
      <div ref={ref} className={cn('print-content', className)}>
        {layout === 'thermal-58mm' && (
          <ThermalReceiptLayout
            order={order}
            width="58mm"
            showPrices={showPrices}
          />
        )}
        {layout === 'thermal-80mm' && (
          <ThermalReceiptLayout
            order={order}
            width="80mm"
            showPrices={showPrices}
          />
        )}
        {layout === 'packing-slip' && (
          <PackingSlipLayout order={order} showPrices={showPrices} />
        )}
      </div>
    );
  }
);
