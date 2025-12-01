# 📦 Advanced Inventory Management System - Implementation Guide

## ✅ What's Been Built

### 1. Database Schema ✅
**File:** `supabase/migrations/20251031230000_advanced_inventory_management.sql`

**Tables Created:**
- `inventory_batches` - Product batches with test results and compliance
- `inventory_packages` - Individual packages tracked through system
- `inventory_transfers_enhanced` - Complete transfer workflow with GPS
- `package_scans` - Chain of custody tracking
- `label_print_queue` - Print queue management

**Features:**
- Auto-generated batch numbers (BD-2024-001)
- Auto-generated package numbers (PKG-BD-2024-001-001)
- Auto-generated transfer numbers (TRN-2024-045)
- Automatic location stock updates
- Batch quantity tracking
- Row Level Security (RLS) policies

### 2. Barcode & QR Code Service ✅
**File:** `src/utils/barcodeService.ts`

**Functions:**
- `generateBarcodeSVG()` - Generate Code128 barcodes
- `generateQRCodeDataURL()` - Generate QR codes with tracking data
- `createPackageQRData()` - Create package QR data structure
- `createTransferQRData()` - Create transfer QR data structure
- `createBatchQRData()` - Create batch QR data structure
- `parseQRCodeData()` - Parse scanned QR codes
- `validateBarcode()` - Validate barcode formats

### 3. Label Printing System ✅
**File:** `src/utils/labelPrinting.ts`

**Templates:**
- Product Label (4x6 inch)
- Small Package Label (2x1 inch)
- Batch Label (4x6 inch)
- Transfer Manifest (4x6 inch)

**Functions:**
- `generateProductLabelHTML()` - Generate product label HTML
- `generateSmallPackageLabelHTML()` - Generate small label HTML
- `generateBatchLabelHTML()` - Generate batch label HTML
- `generateTransferManifestHTML()` - Generate transfer manifest HTML
- `printLabelToPDF()` - Convert to PDF
- `printLabel()` - Open print dialog
- `downloadLabelPDF()` - Download as PDF

### 4. Mobile Scanner Component ✅
**File:** `src/components/inventory/PackageScanner.tsx`

**Features:**
- Camera-based QR/barcode scanning
- Real-time package verification
- Chain of custody display
- Transfer mode (pickup/delivery)
- Error handling

---

## 🚧 Next Steps - Components to Build

### Phase 1: Core Management (Week 1)

#### 1. Inventory Dashboard
**File:** `src/pages/admin/InventoryDashboard.tsx`
- Overview metrics (total inventory, locations, value)
- Location cards with capacity
- Quick actions (create batch, transfer, print)
- Recent activity feed

#### 2. Batch Management
**File:** `src/pages/admin/BatchManagement.tsx`
- Create new batch
- View batch list
- Batch details with test results
- Generate packages from batch
- Print batch labels

#### 3. Package Management
**File:** `src/pages/admin/PackageManagement.tsx`
- View all packages
- Filter by location, status, batch
- Package details with chain of custody
- Print package labels
- Update package status

#### 4. Location Management
**File:** `src/pages/admin/LocationManagement.tsx`
- Create/edit locations
- View location inventory
- Capacity tracking
- Generate location QR codes

### Phase 2: Transfer System (Week 2)

#### 5. Transfer Management
**File:** `src/pages/admin/TransferManagement.tsx`
- Create transfer (select packages, assign runner)
- Transfer approval workflow
- GPS tracking integration
- Transfer status updates
- Print transfer manifest

#### 6. Transfer Tracking (Mobile)
**File:** `src/pages/mobile/TransferTracking.tsx`
- Real-time GPS updates
- Route visualization
- ETA calculation
- Package scanning
- Delivery confirmation

### Phase 3: Mobile & Integration (Week 3)

#### 7. Mobile Runner App
**File:** `src/pages/mobile/RunnerInventory.tsx`
- Active transfers list
- Package scanner integration
- GPS tracking
- Delivery confirmation
- Signature capture

#### 8. Print Queue Manager
**File:** `src/pages/admin/PrintQueue.tsx`
- View pending labels
- Bulk print
- Printer selection
- Print history

### Phase 4: Reports & Integration (Week 4)

#### 9. Chain of Custody Reports
**File:** `src/pages/admin/ChainOfCustodyReport.tsx`
- Package journey visualization
- Export PDF reports
- Audit trail

#### 10. Integration with Orders
**File:** `src/utils/inventoryOrderIntegration.ts`
- Reserve packages for orders
- Auto-create transfers for deliveries
- Update inventory on order completion

#### 11. Integration with Menus
**File:** `src/utils/inventoryMenuIntegration.ts`
- Real-time availability checking
- Low stock alerts
- Automatic menu updates

---

## 📝 Implementation Example

### Creating a Batch

```typescript
import { supabase } from '@/integrations/supabase/client';

async function createBatch(data: {
  accountId: string;
  productId: string;
  totalQuantityLbs: number;
  receivedDate: string;
  supplierName?: string;
  testResults?: {
    thc?: number;
    cbd?: number;
    lab?: string;
    testDate?: string;
  };
}) {
  const { data: batch, error } = await supabase
    .from('inventory_batches')
    .insert({
      account_id: data.accountId,
      product_id: data.productId,
      total_quantity_lbs: data.totalQuantityLbs,
      remaining_quantity_lbs: data.totalQuantityLbs,
      received_date: data.receivedDate,
      supplier_name: data.supplierName,
      test_results: data.testResults || {},
      status: 'active'
    })
    .select()
    .single();

  return { batch, error };
}
```

### Creating Packages from Batch

```typescript
async function createPackagesFromBatch(
  batchId: string,
  packageSizes: number[] // Array of package weights in lbs
) {
  const packages = [];
  
  for (const size of packageSizes) {
    const { data: pkg, error } = await supabase
      .from('inventory_packages')
      .insert({
        batch_id: batchId,
        quantity_lbs: size,
        current_location_id: batchLocationId, // From batch
        status: 'available'
      })
      .select()
      .single();
    
    if (!error && pkg) {
      // Generate barcode and QR code data
      const qrData = createPackageQRData({
        packageId: pkg.id,
        packageNumber: pkg.package_number,
        // ... other data
      });
      
      // Update package with QR data
      await supabase
        .from('inventory_packages')
        .update({ qr_code_data: qrData })
        .eq('id', pkg.id);
      
      packages.push(pkg);
    }
  }
  
  return packages;
}
```

### Creating a Transfer

```typescript
async function createTransfer(data: {
  accountId: string;
  fromLocationId: string;
  toLocationId: string;
  packageIds: string[];
  runnerId: string;
  scheduledAt: string;
}) {
  // Get package details
  const { data: packages } = await supabase
    .from('inventory_packages')
    .select('id, package_number, quantity_lbs, product_id, products(name, wholesale_price)')
    .in('id', data.packageIds);

  const totalQuantity = packages?.reduce((sum, p) => sum + p.quantity_lbs, 0) || 0;
  const totalValue = packages?.reduce((sum, p) => {
    const price = (p.products as any)?.wholesale_price || 0;
    return sum + (p.quantity_lbs * price);
  }, 0) || 0;

  // Create transfer
  const { data: transfer, error } = await supabase
    .from('inventory_transfers_enhanced')
    .insert({
      account_id: data.accountId,
      from_location_id: data.fromLocationId,
      to_location_id: data.toLocationId,
      runner_id: data.runnerId,
      scheduled_at: data.scheduledAt,
      packages: packages?.map(p => ({
        package_id: p.id,
        quantity_lbs: p.quantity_lbs
      })),
      total_quantity_lbs: totalQuantity,
      total_value: totalValue,
      status: 'pending'
    })
    .select()
    .single();

  // Update packages to reserved
  if (!error && transfer) {
    await supabase
      .from('inventory_packages')
      .update({
        status: 'reserved',
        reserved_for_transfer_id: transfer.id
      })
      .in('id', data.packageIds);
  }

  return { transfer, error };
}
```

### Scanning a Package

```typescript
import { PackageScanner } from '@/components/inventory/PackageScanner';

function TransferPickup() {
  const handleScan = async (packageData: PackageQRData) => {
    // Verify package is part of current transfer
    // Update package status to 'in_transit'
    // Record scan in package_scans table
    // Update location stock
    
    await supabase.from('package_scans').insert({
      package_id: packageData.id,
      transfer_id: currentTransferId,
      scan_type: 'transfer_pickup',
      scanned_by: userId,
      location_id: fromLocationId,
      action: 'Picked up for transfer',
      previous_status: 'reserved',
      new_status: 'in_transit'
    });

    await supabase
      .from('inventory_packages')
      .update({ status: 'in_transit' })
      .eq('id', packageData.id);
  };

  return (
    <PackageScanner
      mode="pickup"
      currentTransferId={transferId}
      onScanSuccess={handleScan}
    />
  );
}
```

---

## 🔧 Setup Instructions

### 1. Run Database Migration
```bash
# Apply the migration to your Supabase database
supabase migration up
# Or use Supabase dashboard to run the SQL file
```

### 2. Install Additional Dependencies (if needed)
```bash
npm install qrcode --save-dev  # For server-side QR generation (optional)
```

### 3. Create Admin Pages
- Copy the component structure from existing admin pages
- Integrate the new inventory components
- Add routes in `src/App.tsx`

### 4. Configure Company Name
Update `labelPrinting.ts` with your company name, or pass it as a parameter.

---

## 📊 Database Queries You'll Need

### Get Inventory Summary
```sql
SELECT 
  l.id,
  l.location_name,
  l.location_type,
  l.capacity_lbs,
  l.current_stock_lbs,
  COUNT(DISTINCT p.id) as package_count,
  COUNT(DISTINCT p.batch_id) as batch_count,
  SUM(p.quantity_lbs * pr.wholesale_price) as total_value
FROM inventory_locations l
LEFT JOIN inventory_packages p ON p.current_location_id = l.id
LEFT JOIN products pr ON p.product_id = pr.id
WHERE l.account_id = $1
GROUP BY l.id;
```

### Get Package Chain of Custody
```sql
SELECT 
  ps.*,
  u.email as scanned_by_email,
  l.location_name
FROM package_scans ps
LEFT JOIN auth.users u ON ps.scanned_by = u.id
LEFT JOIN inventory_locations l ON ps.location_id = l.id
WHERE ps.package_id = $1
ORDER BY ps.scanned_at DESC;
```

### Get Active Transfers
```sql
SELECT 
  t.*,
  from_loc.location_name as from_location_name,
  to_loc.location_name as to_location_name,
  u.email as runner_email
FROM inventory_transfers_enhanced t
JOIN inventory_locations from_loc ON t.from_location_id = from_loc.id
JOIN inventory_locations to_loc ON t.to_location_id = to_loc.id
LEFT JOIN auth.users u ON t.runner_id = u.id
WHERE t.account_id = $1
  AND t.status IN ('pending', 'approved', 'in_progress', 'in_transit')
ORDER BY t.scheduled_at DESC;
```

---

## 🎯 Priority Implementation Order

1. **Database Migration** ✅ (Done)
2. **Inventory Dashboard** - Overview and metrics
3. **Batch Management** - Create and view batches
4. **Package Management** - View and manage packages
5. **Transfer Creation** - Basic transfer workflow
6. **Mobile Scanner** ✅ (Component done, needs integration)
7. **Transfer Tracking** - GPS and status updates
8. **Print Queue** - Label printing management
9. **Reports** - Chain of custody and analytics
10. **Integration** - Connect with orders and menus

---

## 📱 Mobile App Integration

The `PackageScanner` component is ready to use. Integrate it into:
- Runner mobile app (`src/pages/mobile/DriverPortal.tsx`)
- Transfer pickup/delivery flows
- Inventory receiving screens

---

## 🔒 Security Notes

- All tables have Row Level Security (RLS) enabled
- Users can only access inventory in their account
- Scans are logged with user ID and timestamp
- Chain of custody cannot be modified (immutable audit trail)

---

## 🚀 Next Actions

1. **Run the database migration** to create the tables
2. **Build the Inventory Dashboard** component
3. **Create Batch Management** page
4. **Test the Package Scanner** component
5. **Build Transfer Management** interface

The foundation is complete! The database schema, barcode service, label printing, and mobile scanner are all ready. Now build the admin UI components to tie it all together.

