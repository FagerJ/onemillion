
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "beer_types": {
                  Row: {
                    "code": string,"label": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"label": string,"sort_order": number
                  }
                  Update: {
                    "code"?: string,"label"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"beers": {
                  Row: {
                    "abv": number | null,"added_by": string,"beer_type": string | null,"client_uuid": string | null,"created_at": string,"global_seq": number,"guild_id": string | null,"id": string,"is_alcohol_free": boolean,"logged_at": string,"party_id": string,"profile_id": string,"round_id": string | null,"session_id": string,"voided_at": string | null,"voided_by": string | null,"volume_ml": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "abv"?: number | null,"added_by": string,"beer_type"?: string | null,"client_uuid"?: string | null,"created_at"?: string,"global_seq"?: number,"guild_id"?: string | null,"id"?: string,"is_alcohol_free"?: boolean,"logged_at"?: string,"party_id": string,"profile_id": string,"round_id"?: string | null,"session_id": string,"voided_at"?: string | null,"voided_by"?: string | null,"volume_ml"?: number | null
                  }
                  Update: {
                    "abv"?: number | null,"added_by"?: string,"beer_type"?: string | null,"client_uuid"?: string | null,"created_at"?: string,"global_seq"?: number,"guild_id"?: string | null,"id"?: string,"is_alcohol_free"?: boolean,"logged_at"?: string,"party_id"?: string,"profile_id"?: string,"round_id"?: string | null,"session_id"?: string,"voided_at"?: string | null,"voided_by"?: string | null,"volume_ml"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "beers_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "beers_beer_type_fkey"
      columns: ["beer_type"]
isOneToOne: false
      referencedRelation: "beer_types"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "beers_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "beers_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "beers_session_id_profile_id_fkey"
      columns: ["session_id","profile_id"]
isOneToOne: false
      referencedRelation: "session_attendees"
      referencedColumns: ["session_id","profile_id"]
    },{
      foreignKeyName: "beers_voided_by_fkey"
      columns: ["voided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"global_stats": {
                  Row: {
                    "id": number,"total_beers": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: number,"total_beers"?: number,"updated_at"?: string
                  }
                  Update: {
                    "id"?: number,"total_beers"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"parties": {
                  Row: {
                    "accent_color": string,"created_at": string,"created_by": string,"guild_id": string | null,"guild_joined_at": string | null,"id": string,"invite_code": string,"max_members": number,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accent_color"?: string,"created_at"?: string,"created_by": string,"guild_id"?: string | null,"guild_joined_at"?: string | null,"id"?: string,"invite_code"?: string,"max_members"?: number,"name": string
                  }
                  Update: {
                    "accent_color"?: string,"created_at"?: string,"created_by"?: string,"guild_id"?: string | null,"guild_joined_at"?: string | null,"id"?: string,"invite_code"?: string,"max_members"?: number,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "parties_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"party_members": {
                  Row: {
                    "joined_at": string,"left_at": string | null,"party_id": string,"profile_id": string,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "joined_at"?: string,"left_at"?: string | null,"party_id": string,"profile_id": string,"role"?: string
                  }
                  Update: {
                    "joined_at"?: string,"left_at"?: string | null,"party_id"?: string,"profile_id"?: string,"role"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "party_members_party_id_fkey"
      columns: ["party_id"]
isOneToOne: false
      referencedRelation: "parties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "party_members_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"party_stats": {
                  Row: {
                    "last_logged_at": string | null,"party_id": string,"total_beers": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "last_logged_at"?: string | null,"party_id": string,"total_beers"?: number,"updated_at"?: string
                  }
                  Update: {
                    "last_logged_at"?: string | null,"party_id"?: string,"total_beers"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "party_stats_party_id_fkey"
      columns: ["party_id"]
isOneToOne: true
      referencedRelation: "parties"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_stats": {
                  Row: {
                    "last_logged_at": string | null,"profile_id": string,"total_beers": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "last_logged_at"?: string | null,"profile_id": string,"total_beers"?: number,"updated_at"?: string
                  }
                  Update: {
                    "last_logged_at"?: string | null,"profile_id"?: string,"total_beers"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_stats_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_color": string,"created_at": string,"display_name": string,"home_city": string | null,"id": string,"initials": string,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_color"?: string,"created_at"?: string,"display_name": string,"home_city"?: string | null,"id": string,"initials": string,"timezone"?: string
                  }
                  Update: {
                    "avatar_color"?: string,"created_at"?: string,"display_name"?: string,"home_city"?: string | null,"id"?: string,"initials"?: string,"timezone"?: string
                  }
                  Relationships: [
                    
                  ]
                },"session_attendees": {
                  Row: {
                    "in_rounds": boolean,"joined_at": string,"party_id": string,"profile_id": string,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "in_rounds"?: boolean,"joined_at"?: string,"party_id": string,"profile_id": string,"session_id": string
                  }
                  Update: {
                    "in_rounds"?: boolean,"joined_at"?: string,"party_id"?: string,"profile_id"?: string,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_attendees_party_id_profile_id_fkey"
      columns: ["party_id","profile_id"]
isOneToOne: false
      referencedRelation: "party_members"
      referencedColumns: ["party_id","profile_id"]
    },{
      foreignKeyName: "session_attendees_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_attendees_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"sessions": {
                  Row: {
                    "closed_at": string | null,"closes_at": string,"created_at": string,"created_by": string,"guild_id": string | null,"id": string,"note": string | null,"party_id": string,"started_at": string,"status": string,"timezone": string,"venue_name": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "closed_at"?: string | null,"closes_at": string,"created_at"?: string,"created_by": string,"guild_id"?: string | null,"id"?: string,"note"?: string | null,"party_id": string,"started_at"?: string,"status"?: string,"timezone": string,"venue_name"?: string | null
                  }
                  Update: {
                    "closed_at"?: string | null,"closes_at"?: string,"created_at"?: string,"created_by"?: string,"guild_id"?: string | null,"id"?: string,"note"?: string | null,"party_id"?: string,"started_at"?: string,"status"?: string,"timezone"?: string,"venue_name"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sessions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sessions_party_id_fkey"
      columns: ["party_id"]
isOneToOne: false
      referencedRelation: "parties"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "close_session":
{ Args: { "p_session": string }; Returns: undefined
                           },
"close_stale_sessions":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"create_party":
{ Args: { "p_name": string }; Returns: {
              "accent_color": string,
"created_at": string,
"created_by": string,
"guild_id": string | null,
"guild_joined_at": string | null,
"id": string,
"invite_code": string,
"max_members": number,
"name": string
            }
                          SetofOptions: {
        from: "*"
        to: "parties"
        isOneToOne: true
        isSetofReturn: false
      } },
"generate_invite_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"is_party_captain":
{ Args: { "p_party": string }; Returns: boolean
                           },
"is_party_member":
{ Args: { "p_party": string }; Returns: boolean
                           },
"is_session_attendee":
{ Args: { "p_session": string }; Returns: boolean
                           },
"join_party":
{ Args: { "p_code": string }; Returns: {
              "accent_color": string,
"created_at": string,
"created_by": string,
"guild_id": string | null,
"guild_joined_at": string | null,
"id": string,
"invite_code": string,
"max_members": number,
"name": string
            }
                          SetofOptions: {
        from: "*"
        to: "parties"
        isOneToOne: true
        isSetofReturn: false
      } },
"leave_party":
{ Args: { "p_party": string }; Returns: undefined
                           },
"party_feed":
{ Args: { "p_before"?: string,"p_limit"?: number,"p_party": string }; Returns: {
              "attendees": Json,"closed_at": string,"closes_at": string,"note": string,"session_id": string,"started_at": string,"status": string,"total_beers": number
            }[]
                           },
"party_leaderboard":
{ Args: { "p_party": string }; Returns: {
              "avatar_color": string,"beers_this_week": number,"display_name": string,"initials": string,"is_current": boolean,"profile_id": string,"total_beers": number
            }[]
                           },
"party_summary":
{ Args: { "p_party": string }; Returns: {
              "beers_this_week": number,"best_streak_weeks": number,"current_streak_weeks": number,"last_logged_at": string,"total_beers": number
            }[]
                           },
"profile_summary":
{ Args: { "p_profile": string }; Returns: {
              "beers_this_week": number,"best_streak_weeks": number,"current_streak_weeks": number,"last_logged_at": string,"total_beers": number
            }[]
                           },
"promote_member":
{ Args: { "p_party": string,"p_profile": string }; Returns: undefined
                           },
"purge_lonely_sessions":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"recompute_stats":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"regenerate_invite_code":
{ Args: { "p_party": string }; Returns: string
                           },
"remove_member":
{ Args: { "p_party": string,"p_profile": string }; Returns: undefined
                           },
"shares_party_with":
{ Args: { "p_profile": string }; Returns: boolean
                           },
"streak_of":
{ Args: { "p_this_week": string,"p_weeks": (string)[] }; Returns: Record<string, unknown>
                           },
"week_start":
{ Args: { "p_at": string,"p_tz": string }; Returns: string
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
