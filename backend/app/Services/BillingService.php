<?php
namespace App\Services;

use App\Models\AuditEvent;
use App\Models\BillNumberSequence;
use App\Models\Payment;
use App\Models\SalesBill;
use Illuminate\Support\Facades\DB;

class BillingService
{
    public function __construct(private InventoryService $inventory) {}

    public function generateBillNumber(): string
    {
        return DB::transaction(function () {
            $year   = now()->year;
            $prefix = 'GND';
            $seq    = BillNumberSequence::lockForUpdate()
                ->firstOrCreate(['prefix' => $prefix, 'year' => $year], ['last_number' => 0]);
            $seq->increment('last_number');
            return sprintf('%s/%d/%04d', $prefix, $year, $seq->last_number);
        });
    }

    public function postBill(SalesBill $bill): SalesBill
    {
        if ($bill->status !== 'draft') {
            throw new \RuntimeException('Only draft bills can be posted.');
        }

        DB::transaction(function () use ($bill) {
            $bill->recalculateTotals();
            $bill->update(['status' => 'posted', 'posted_at' => now()]);
            $this->inventory->deductForSale($bill);
            $this->updatePaymentStatus($bill);
            AuditEvent::log('sale', 'bill_posted', $bill);
        });

        return $bill->fresh();
    }

    public function recordPayment(SalesBill $bill, array $data): Payment
    {
        return DB::transaction(function () use ($bill, $data) {
            $payment = Payment::create([
                'bill_id'      => $bill->id,
                'received_by'  => auth()->id(),
                'mode'         => $data['mode'],
                'amount'       => $data['amount'],
                'reference'    => $data['reference'] ?? null,
                'payment_date' => $data['payment_date'] ?? today(),
                'payment_time' => $data['payment_time'] ?? now()->toTimeString(),
                'notes'        => $data['notes'] ?? null,
                'status'       => 'confirmed',
            ]);

            $bill->increment('amount_paid', $data['amount']);
            $this->updatePaymentStatus($bill->fresh());
            AuditEvent::log('payment', 'payment_recorded', $payment);

            return $payment;
        });
    }

    public function voidBill(SalesBill $bill, string $reason): void
    {
        if (!in_array($bill->status, ['draft', 'posted', 'partial'])) {
            throw new \RuntimeException('Bill cannot be voided in its current status.');
        }

        DB::transaction(function () use ($bill, $reason) {
            $before = $bill->toArray();
            // Reverse stock if already posted
            if ($bill->status !== 'draft') {
                foreach ($bill->lineItems as $item) {
                    $this->inventory->move($item->variant, 'return', $item->quantity, $bill, "Void: $reason");
                }
            }
            $bill->update(['status' => 'void']);
            AuditEvent::log('sale', 'bill_voided', $bill, ['before' => $before, 'reason' => $reason]);
        });
    }

    private function updatePaymentStatus(SalesBill $bill): void
    {
        if ($bill->amount_due <= 0) {
            $bill->update(['status' => 'paid']);
        } elseif ($bill->amount_paid > 0) {
            $bill->update(['status' => 'partial']);
        }
    }
}
