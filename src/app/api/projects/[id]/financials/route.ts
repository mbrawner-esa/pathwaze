import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Cost line items — when any of these change, total_cost is recomputed.
const COST_LINE_ITEM_FIELDS = [
  'estimated_epc_cost',
  'estimated_dev_costs',
  'estimated_ix_costs',
  'development_fee',
]

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  // Only recompute total_cost if at least one cost line item is being updated.
  // Otherwise leave it alone so partial updates (e.g., contract-only) don't zero it.
  const touchesCosts = COST_LINE_ITEM_FIELDS.some(f => body[f] !== undefined)

  const update: Record<string, unknown> = { ...body }
  if (touchesCosts) {
    // Read current row to fill in any cost fields not present in this body
    const { data: current } = await supabase
      .from('project_financials')
      .select('estimated_epc_cost, estimated_dev_costs, estimated_ix_costs, development_fee')
      .eq('project_id', id)
      .single() as { data: { estimated_epc_cost?: number; estimated_dev_costs?: number; estimated_ix_costs?: number; development_fee?: number } | null }
    const epc = Number(body.estimated_epc_cost ?? current?.estimated_epc_cost ?? 0)
    const dev = Number(body.estimated_dev_costs ?? current?.estimated_dev_costs ?? 0)
    const ix  = Number(body.estimated_ix_costs ?? current?.estimated_ix_costs ?? 0)
    const fee = Number(body.development_fee ?? current?.development_fee ?? 0)
    update.total_cost = epc + dev + ix + fee
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('project_financials') as any)
    .update(update)
    .eq('project_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, total_cost: update.total_cost })
}
