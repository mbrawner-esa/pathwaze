export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          project_number: string
          name: string
          customer: string
          stage: string
          deal_health: string
          system_kwdc: number
          system_kwac: number
          annual_production_kwh: number
          address: string
          city: string
          state: string
          zip: string
          lat: number
          lng: number
          utility: string
          rate_schedule: string
          rate_schedule_type: string
          annual_usage_kwh: number
          peak_demand_kw: number
          interconnection_num: string
          interconnection_status: string
          interconnection_voltage: string
          interconnection_feasibility: string
          interconnection_cost_estimate: number
          nem_program: string
          utility_poc: string
          ahj: string
          building_permit_num: string
          building_permit_status: string
          electrical_permit_num: string
          permit_submitted: string | null
          permit_approved: string | null
          inspector: string
          assignee_id: string | null
          facility_type: string
          site_type: string
          site_acres: number
          roof_type: string
          modules: string
          inverters: string
          monitoring: string
          azimuth: string
          tilt: string
          region: string
          tranche: string
          start_date: string | null
          target_cod: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['projects']['Insert']>
      }
      project_financials: {
        Row: {
          id: string
          project_id: string
          total_cost: number
          itc_eligible_costs: number
          itc_ineligible_costs: number
          estimated_epc_cost: number
          estimated_dev_costs: number
          estimated_ix_costs: number
          development_fee: number
          itc_rate: number
          domestic_content_assumed: boolean
          safe_harbor_required: boolean
          other_incentives_total: number
          incentive_type: string
          contract_type: string
          revenue_type: string
          offtaker_credit: string
          term_months: number
          year1_contract_price: number
          escalation_rate: number
          srec_treatment: string
          avoided_cost_kwh: number
          yield_kwh_kwp: number
          energy_gen_year1_mwh: number
          system_type: string
          annual_savings: number
          payback_years: number
        }
        Insert: Omit<Database['public']['Tables']['project_financials']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['project_financials']['Insert']>
      }
      milestones: {
        Row: {
          id: string
          project_id: string
          label: string
          target_date: string | null
          completed: boolean
          completed_at: string | null
          sort_order: number
        }
        Insert: Omit<Database['public']['Tables']['milestones']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['milestones']['Insert']>
      }
      tasks: {
        Row: {
          id: string
          project_id: string | null
          title: string
          description: string | null
          type: string
          status: string
          priority: string
          assignee_id: string | null
          approver_id: string | null
          requires_approval: boolean
          approval_status: string | null
          approval_notes: string | null
          due_date: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['tasks']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>
      }
      task_threads: {
        Row: {
          id: string
          task_id: string
          user_id: string
          message: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['task_threads']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['task_threads']['Insert']>
      }
      stakeholders: {
        Row: {
          id: string
          project_id: string | null
          name: string
          title: string
          department: string
          role: string
          email: string
          phone: string
          sentiment: string
          is_primary: boolean
          org: string
        }
        Insert: Omit<Database['public']['Tables']['stakeholders']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['stakeholders']['Insert']>
      }
      stakeholder_tasks: {
        Row: { id: string; stakeholder_id: string; text: string; done: boolean }
        Insert: Omit<Database['public']['Tables']['stakeholder_tasks']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['stakeholder_tasks']['Insert']>
      }
      stakeholder_feed: {
        Row: { id: string; stakeholder_id: string; type: string; date: string; user_name: string; text: string; subject: string | null; from_addr: string | null; to_addr: string | null }
        Insert: Omit<Database['public']['Tables']['stakeholder_feed']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['stakeholder_feed']['Insert']>
      }
      dataroom_docs: {
        Row: {
          id: string
          project_id: string
          category_id: string
          subcategory_id: string
          doc_name: string
          status: string
          box_file_id: string | null
          file_name: string | null
          uploaded_by: string | null
          uploaded_at: string | null
          notes: string | null
        }
        Insert: Omit<Database['public']['Tables']['dataroom_docs']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['dataroom_docs']['Insert']>
      }
      users: {
        Row: { id: string; email: string; full_name: string; role: string; avatar_url: string | null; created_at: string }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      activity_log: {
        Row: { id: string; entity_type: string; entity_id: string; action: string; user_id: string | null; metadata: Json | null; created_at: string }
        Insert: Omit<Database['public']['Tables']['activity_log']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['activity_log']['Insert']>
      }
      permits: {
        Row: { id: string; project_id: string; name: string; category: string; level: string; status: string; ahj: string | null; submitted_at: string | null; approved_at: string | null; expiry_date: string | null; notes: string | null }
        Insert: Omit<Database['public']['Tables']['permits']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['permits']['Insert']>
      }
      investor_access: {
        Row: { id: string; investor_id: string; project_id: string; tranche: string | null; granted_at: string }
        Insert: Omit<Database['public']['Tables']['investor_access']['Row'], 'id' | 'granted_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['investor_access']['Insert']>
      }
    }
  }
}
