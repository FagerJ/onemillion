
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "achievement_unlocks": {
                  Row: {
                    "achievement_code": string,"beer_id": string | null,"created_at": string,"crew_id": string | null,"guild_id": string | null,"id": string,"profile_id": string | null,"session_id": string | null,"source": string,"tier": string,"unlocked_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "achievement_code": string,"beer_id"?: string | null,"created_at"?: string,"crew_id"?: string | null,"guild_id"?: string | null,"id"?: string,"profile_id"?: string | null,"session_id"?: string | null,"source"?: string,"tier": string,"unlocked_at": string
                  }
                  Update: {
                    "achievement_code"?: string,"beer_id"?: string | null,"created_at"?: string,"crew_id"?: string | null,"guild_id"?: string | null,"id"?: string,"profile_id"?: string | null,"session_id"?: string | null,"source"?: string,"tier"?: string,"unlocked_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "achievement_unlocks_achievement_code_tier_fkey"
      columns: ["achievement_code","tier"]
isOneToOne: false
      referencedRelation: "achievements"
      referencedColumns: ["code","tier"]
    },{
      foreignKeyName: "achievement_unlocks_beer_id_fkey"
      columns: ["beer_id"]
isOneToOne: false
      referencedRelation: "beers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "achievement_unlocks_beer_id_fkey"
      columns: ["beer_id"]
isOneToOne: false
      referencedRelation: "counted_nights"
      referencedColumns: ["first_beer_id"]
    },{
      foreignKeyName: "achievement_unlocks_crew_id_fkey"
      columns: ["crew_id"]
isOneToOne: false
      referencedRelation: "crews"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "achievement_unlocks_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "achievement_unlocks_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "counted_nights"
      referencedColumns: ["session_id"]
    },{
      foreignKeyName: "achievement_unlocks_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "driven_nights"
      referencedColumns: ["session_id"]
    },{
      foreignKeyName: "achievement_unlocks_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"achievements": {
                  Row: {
                    "art": NonNullable<Json>,"category": string,"code": string,"created_at": string,"description": string,"flavor": string | null,"is_secret": boolean,"points": number,"retired_at": string | null,"rule": NonNullable<Json>,"sort": number,"tier": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "art"?: NonNullable<Json>,"category": string,"code": string,"created_at"?: string,"description": string,"flavor"?: string | null,"is_secret"?: boolean,"points": number,"retired_at"?: string | null,"rule": NonNullable<Json>,"sort": number,"tier": string,"title": string
                  }
                  Update: {
                    "art"?: NonNullable<Json>,"category"?: string,"code"?: string,"created_at"?: string,"description"?: string,"flavor"?: string | null,"is_secret"?: boolean,"points"?: number,"retired_at"?: string | null,"rule"?: NonNullable<Json>,"sort"?: number,"tier"?: string,"title"?: string
                  }
                  Relationships: [
                    
                  ]
                },"beer_types": {
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
                    "abv": number | null,"added_by": string,"beer_type": string | null,"client_uuid": string | null,"created_at": string,"crew_id": string,"global_seq": number,"guild_id": string | null,"id": string,"is_alcohol_free": boolean,"logged_at": string,"profile_id": string,"round_id": string | null,"session_id": string,"voided_at": string | null,"voided_by": string | null,"volume_ml": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "abv"?: number | null,"added_by": string,"beer_type"?: string | null,"client_uuid"?: string | null,"created_at"?: string,"crew_id": string,"global_seq"?: number,"guild_id"?: string | null,"id"?: string,"is_alcohol_free"?: boolean,"logged_at"?: string,"profile_id": string,"round_id"?: string | null,"session_id": string,"voided_at"?: string | null,"voided_by"?: string | null,"volume_ml"?: number | null
                  }
                  Update: {
                    "abv"?: number | null,"added_by"?: string,"beer_type"?: string | null,"client_uuid"?: string | null,"created_at"?: string,"crew_id"?: string,"global_seq"?: number,"guild_id"?: string | null,"id"?: string,"is_alcohol_free"?: boolean,"logged_at"?: string,"profile_id"?: string,"round_id"?: string | null,"session_id"?: string,"voided_at"?: string | null,"voided_by"?: string | null,"volume_ml"?: number | null
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
      referencedRelation: "counted_nights"
      referencedColumns: ["session_id"]
    },{
      foreignKeyName: "beers_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "driven_nights"
      referencedColumns: ["session_id"]
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
                },"crew_members": {
                  Row: {
                    "crew_id": string,"joined_at": string,"left_at": string | null,"profile_id": string,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "crew_id": string,"joined_at"?: string,"left_at"?: string | null,"profile_id": string,"role"?: string
                  }
                  Update: {
                    "crew_id"?: string,"joined_at"?: string,"left_at"?: string | null,"profile_id"?: string,"role"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "crew_members_crew_id_fkey"
      columns: ["crew_id"]
isOneToOne: false
      referencedRelation: "crews"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "crew_members_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"crew_stats": {
                  Row: {
                    "crew_id": string,"last_logged_at": string | null,"total_beers": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "crew_id": string,"last_logged_at"?: string | null,"total_beers"?: number,"updated_at"?: string
                  }
                  Update: {
                    "crew_id"?: string,"last_logged_at"?: string | null,"total_beers"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "crew_stats_crew_id_fkey"
      columns: ["crew_id"]
isOneToOne: true
      referencedRelation: "crews"
      referencedColumns: ["id"]
    }
                  ]
                },"crews": {
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
      foreignKeyName: "crews_created_by_fkey"
      columns: ["created_by"]
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
                },"milestone_events": {
                  Row: {
                    "added_by": string,"backfilled": boolean,"beer_id": string | null,"crew_id": string,"crossed_at": string,"id": string,"profile_id": string,"round_id": string | null,"scope": string,"scope_id": string | null,"session_id": string | null,"threshold": number
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by": string,"backfilled"?: boolean,"beer_id"?: string | null,"crew_id": string,"crossed_at"?: string,"id"?: string,"profile_id": string,"round_id"?: string | null,"scope": string,"scope_id"?: string | null,"session_id"?: string | null,"threshold": number
                  }
                  Update: {
                    "added_by"?: string,"backfilled"?: boolean,"beer_id"?: string | null,"crew_id"?: string,"crossed_at"?: string,"id"?: string,"profile_id"?: string,"round_id"?: string | null,"scope"?: string,"scope_id"?: string | null,"session_id"?: string | null,"threshold"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "milestone_events_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "milestone_events_beer_id_fkey"
      columns: ["beer_id"]
isOneToOne: false
      referencedRelation: "beers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "milestone_events_beer_id_fkey"
      columns: ["beer_id"]
isOneToOne: false
      referencedRelation: "counted_nights"
      referencedColumns: ["first_beer_id"]
    },{
      foreignKeyName: "milestone_events_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "milestone_events_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "counted_nights"
      referencedColumns: ["session_id"]
    },{
      foreignKeyName: "milestone_events_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "driven_nights"
      referencedColumns: ["session_id"]
    },{
      foreignKeyName: "milestone_events_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "milestone_events_threshold_fkey"
      columns: ["threshold"]
isOneToOne: false
      referencedRelation: "milestones"
      referencedColumns: ["threshold"]
    }
                  ]
                },"milestones": {
                  Row: {
                    "kind": string,"scopes": (string)[],"threshold": number,"tier": string
                  }
                  ComputedFields: never
                  Insert: {
                    "kind"?: string,"scopes": (string)[],"threshold": number,"tier": string
                  }
                  Update: {
                    "kind"?: string,"scopes"?: (string)[],"threshold"?: number,"tier"?: string
                  }
                  Relationships: [
                    
                  ]
                },"poll_votes": {
                  Row: {
                    "choice": string,"comment": string | null,"created_at": string,"name": string,"poll_id": string,"updated_at": string,"voter": string
                  }
                  ComputedFields: never
                  Insert: {
                    "choice": string,"comment"?: string | null,"created_at"?: string,"name": string,"poll_id": string,"updated_at"?: string,"voter": string
                  }
                  Update: {
                    "choice"?: string,"comment"?: string | null,"created_at"?: string,"name"?: string,"poll_id"?: string,"updated_at"?: string,"voter"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "poll_votes_poll_id_fkey"
      columns: ["poll_id"]
isOneToOne: false
      referencedRelation: "polls"
      referencedColumns: ["id"]
    }
                  ]
                },"polls": {
                  Row: {
                    "created_at": string,"id": string,"is_open": boolean,"options": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id": string,"is_open"?: boolean,"options": (string)[]
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_open"?: boolean,"options"?: (string)[]
                  }
                  Relationships: [
                    
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
                    "crew_id": string,"in_rounds": boolean,"joined_at": string,"profile_id": string,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "crew_id": string,"in_rounds"?: boolean,"joined_at"?: string,"profile_id": string,"session_id": string
                  }
                  Update: {
                    "crew_id"?: string,"in_rounds"?: boolean,"joined_at"?: string,"profile_id"?: string,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_attendees_crew_id_profile_id_fkey"
      columns: ["crew_id","profile_id"]
isOneToOne: false
      referencedRelation: "crew_members"
      referencedColumns: ["crew_id","profile_id"]
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
      referencedRelation: "counted_nights"
      referencedColumns: ["session_id"]
    },{
      foreignKeyName: "session_attendees_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "driven_nights"
      referencedColumns: ["session_id"]
    },{
      foreignKeyName: "session_attendees_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"session_combos": {
                  Row: {
                    "achievement_code": string,"beer_id": string | null,"created_at": string,"crew_id": string,"reached_at": string,"session_id": string,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "achievement_code": string,"beer_id"?: string | null,"created_at"?: string,"crew_id": string,"reached_at": string,"session_id": string,"source"?: string
                  }
                  Update: {
                    "achievement_code"?: string,"beer_id"?: string | null,"created_at"?: string,"crew_id"?: string,"reached_at"?: string,"session_id"?: string,"source"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_combos_achievement_code_fkey"
      columns: ["achievement_code"]
isOneToOne: false
      referencedRelation: "achievements"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "session_combos_beer_id_fkey"
      columns: ["beer_id"]
isOneToOne: false
      referencedRelation: "beers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_combos_beer_id_fkey"
      columns: ["beer_id"]
isOneToOne: false
      referencedRelation: "counted_nights"
      referencedColumns: ["first_beer_id"]
    },{
      foreignKeyName: "session_combos_crew_id_fkey"
      columns: ["crew_id"]
isOneToOne: false
      referencedRelation: "crews"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_combos_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "counted_nights"
      referencedColumns: ["session_id"]
    },{
      foreignKeyName: "session_combos_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "driven_nights"
      referencedColumns: ["session_id"]
    },{
      foreignKeyName: "session_combos_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"sessions": {
                  Row: {
                    "closed_at": string | null,"closes_at": string,"created_at": string,"created_by": string,"crew_id": string,"guild_id": string | null,"id": string,"note": string | null,"started_at": string,"status": string,"timezone": string,"venue_name": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "closed_at"?: string | null,"closes_at": string,"created_at"?: string,"created_by": string,"crew_id": string,"guild_id"?: string | null,"id"?: string,"note"?: string | null,"started_at"?: string,"status"?: string,"timezone": string,"venue_name"?: string | null
                  }
                  Update: {
                    "closed_at"?: string | null,"closes_at"?: string,"created_at"?: string,"created_by"?: string,"crew_id"?: string,"guild_id"?: string | null,"id"?: string,"note"?: string | null,"started_at"?: string,"status"?: string,"timezone"?: string,"venue_name"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sessions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sessions_crew_id_fkey"
      columns: ["crew_id"]
isOneToOne: false
      referencedRelation: "crews"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "counted_nights": {
                  Row: {
                    "closed_at": string | null,"crew_id": string | null,"first_beer_at": string | null,"first_beer_id": string | null,"first_beer_seq": number | null,"guild_id": string | null,"session_id": string | null,"started_at": string | null,"week": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "sessions_crew_id_fkey"
      columns: ["crew_id"]
isOneToOne: false
      referencedRelation: "crews"
      referencedColumns: ["id"]
    }
                  ]
                },"driven_nights": {
                  Row: {
                    "closed_at": string | null,"crew_id": string | null,"ended_at": string | null,"guild_id": string | null,"profile_id": string | null,"session_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "session_attendees_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sessions_crew_id_fkey"
      columns: ["crew_id"]
isOneToOne: false
      referencedRelation: "crews"
      referencedColumns: ["id"]
    }
                  ]
                },"poured_rounds": {
                  Row: {
                    "beer_id": string | null,"crew_id": string | null,"first_seq": number | null,"guild_id": string | null,"poured_at": string | null,"profile_id": string | null,"round_id": string | null,"session_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "beers_added_by_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "achievement_catalogue":
{ Args: Record<PropertyKey, never>; Returns: {
              "art": Json,"category": string,"code": string,"description": string,"flavor": string,"is_retired": boolean,"is_secret": boolean,"points": number,"sort": number,"target": number,"tier": string,"title": string
            }[]
                           },
"achievement_rule_ok":
{ Args: { "p_rule": Json,"p_tier": string }; Returns: boolean
                           },
"award_alcohol_free_beers":
{ Args: { "p_profiles": (string)[],"p_source": string }; Returns: undefined
                           },
"award_combo_rungs":
{ Args: { "p_crews": (string)[],"p_source": string }; Returns: undefined
                           },
"award_full_crew":
{ Args: { "p_crews": (string)[],"p_source": string }; Returns: undefined
                           },
"award_lifetime_beers":
{ Args: { "p_crews": (string)[],"p_profiles": (string)[],"p_source": string }; Returns: undefined
                           },
"award_members":
{ Args: { "p_crews": (string)[],"p_source": string }; Returns: undefined
                           },
"award_nights":
{ Args: { "p_profiles": (string)[],"p_source": string }; Returns: undefined
                           },
"award_nights_driving":
{ Args: { "p_now"?: string,"p_profiles": (string)[],"p_source": string }; Returns: undefined
                           },
"award_rounds_poured":
{ Args: { "p_profiles": (string)[],"p_source": string }; Returns: undefined
                           },
"award_session":
{ Args: { "p_night_level": boolean,"p_session": string,"p_source": string }; Returns: undefined
                           },
"award_session_size":
{ Args: { "p_crews": (string)[],"p_source": string }; Returns: undefined
                           },
"award_session_total":
{ Args: { "p_sessions": (string)[],"p_source": string }; Returns: undefined
                           },
"award_streak_weeks":
{ Args: { "p_crews": (string)[],"p_profiles": (string)[],"p_source": string }; Returns: undefined
                           },
"award_week_off":
{ Args: { "p_now"?: string,"p_profiles": (string)[],"p_source": string }; Returns: undefined
                           },
"backfill_milestones":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"can_see_unlock":
{ Args: { "p_crew": string,"p_profile": string,"p_tier": string }; Returns: boolean
                           },
"cast_vote":
{ Args: { "p_choice": string,"p_comment"?: string,"p_name": string,"p_poll": string,"p_voter": string }; Returns: undefined
                           },
"close_session":
{ Args: { "p_session": string }; Returns: undefined
                           },
"close_stale_sessions":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"create_crew":
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
        to: "crews"
        isOneToOne: true
        isSetofReturn: false
      } },
"crew_achievement_progress":
{ Args: { "p_crew": string }; Returns: {
              "code": string,"progress": number,"target": number
            }[]
                           },
"crew_feed":
{ Args: { "p_before"?: string,"p_crew": string,"p_limit"?: number }; Returns: {
              "attendees": Json,"closed_at": string,"closes_at": string,"note": string,"session_id": string,"started_at": string,"status": string,"total_beers": number
            }[]
                           },
"crew_leaderboard":
{ Args: { "p_crew": string }; Returns: {
              "avatar_color": string,"beers_this_week": number,"display_name": string,"initials": string,"is_current": boolean,"profile_id": string,"total_beers": number
            }[]
                           },
"crew_summary":
{ Args: { "p_crew": string }; Returns: {
              "beers_this_week": number,"best_streak_weeks": number,"current_streak_weeks": number,"last_logged_at": string,"total_beers": number
            }[]
                           },
"generate_invite_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"is_crew_captain":
{ Args: { "p_crew": string }; Returns: boolean
                           },
"is_crew_member":
{ Args: { "p_crew": string }; Returns: boolean
                           },
"is_session_attendee":
{ Args: { "p_session": string }; Returns: boolean
                           },
"join_crew":
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
        to: "crews"
        isOneToOne: true
        isSetofReturn: false
      } },
"leave_crew":
{ Args: { "p_crew": string }; Returns: undefined
                           },
"poll_results":
{ Args: { "p_poll": string }; Returns: {
              "choice": string,"comment": string,"name": string,"voted_at": string
            }[]
                           },
"profile_achievement_progress":
{ Args: { "p_profile": string }; Returns: {
              "code": string,"progress": number,"target": number
            }[]
                           },
"profile_summary":
{ Args: { "p_profile": string }; Returns: {
              "beers_this_week": number,"best_streak_weeks": number,"current_streak_weeks": number,"last_logged_at": string,"total_beers": number
            }[]
                           },
"promote_member":
{ Args: { "p_crew": string,"p_profile": string }; Returns: undefined
                           },
"purge_lonely_sessions":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"recompute_stats":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"regenerate_invite_code":
{ Args: { "p_crew": string }; Returns: string
                           },
"remove_member":
{ Args: { "p_crew": string,"p_profile": string }; Returns: undefined
                           },
"settle_drivers":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"shares_crew_with":
{ Args: { "p_profile": string }; Returns: boolean
                           },
"streak_of":
{ Args: { "p_this_week": string,"p_weeks": (string)[] }; Returns: Record<string, unknown>
                           },
"sweep_achievements":
{ Args: { "p_source"?: string }; Returns: number
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
