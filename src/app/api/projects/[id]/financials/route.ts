import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  // Auto-recalc total_cost from 4 line items
  const total_cost = (Number(body.estimated_epc_cost) || 0) +
    (Number(body.estimated_dev_costs) || 0) +
    (Number(body.estimated_ix_costs) || 0) +
    (Number(body.development_fee) || 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('project_financials') as any)
    .update({ ...body, total_cost })
    .eq('project_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, total_cost })
}
