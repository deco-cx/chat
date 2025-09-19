export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)";
  };
  public: {
    Tables: {
      admin_ai_usage: {
        Row: {
          created_at: string;
          event_name: string | null;
          id: number;
          sitename: string | null;
          user_id: string | null;
          value: number | null;
        };
        Insert: {
          created_at?: string;
          event_name?: string | null;
          id?: number;
          sitename?: string | null;
          user_id?: string | null;
          value?: number | null;
        };
        Update: {
          created_at?: string;
          event_name?: string | null;
          id?: number;
          sitename?: string | null;
          user_id?: string | null;
          value?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "admin_ai_usage_sitename_fkey";
            columns: ["sitename"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["name"];
          },
          {
            foreignKeyName: "admin_ai_usage_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      ai_query_limit: {
        Row: {
          count: number | null;
          created_at: string;
          id: number;
          team_id: number | null;
        };
        Insert: {
          count?: number | null;
          created_at: string;
          id?: number;
          team_id?: number | null;
        };
        Update: {
          count?: number | null;
          created_at?: string;
          id?: number;
          team_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "public_ai_query_limit_teamId_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      api_key: {
        Row: {
          created_at: string;
          id: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "api_key_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users_meta_data_view";
            referencedColumns: ["id"];
          },
        ];
      };
      apps: {
        Row: {
          authority: string;
          category: string | null;
          created_at: string;
          description: string;
          id: number;
          logo: string;
          name: string;
          path: string;
          title: string;
          type: string;
          vendor_alias: string | null;
        };
        Insert: {
          authority: string;
          category?: string | null;
          created_at?: string;
          description: string;
          id?: number;
          logo: string;
          name: string;
          path: string;
          title: string;
          type: string;
          vendor_alias?: string | null;
        };
        Update: {
          authority?: string;
          category?: string | null;
          created_at?: string;
          description?: string;
          id?: number;
          logo?: string;
          name?: string;
          path?: string;
          title?: string;
          type?: string;
          vendor_alias?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "apps_vendor_alias_fkey";
            columns: ["vendor_alias"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["alias"];
          },
        ];
      };
      assets: {
        Row: {
          asset_id: string | null;
          brightness: number | null;
          created_at: string;
          id: number;
          label: string | null;
          mime: string | null;
          path: string;
          preview: string | null;
          publicUrl: string;
          site_id: number;
          updated_at: string;
        };
        Insert: {
          asset_id?: string | null;
          brightness?: number | null;
          created_at?: string;
          id?: number;
          label?: string | null;
          mime?: string | null;
          path: string;
          preview?: string | null;
          publicUrl: string;
          site_id: number;
          updated_at?: string;
        };
        Update: {
          asset_id?: string | null;
          brightness?: number | null;
          created_at?: string;
          id?: number;
          label?: string | null;
          mime?: string | null;
          path?: string;
          preview?: string | null;
          publicUrl?: string;
          site_id?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assets_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
      assets_tag: {
        Row: {
          asset_id: number | null;
          created_at: string;
          id: number;
          tag_id: number | null;
        };
        Insert: {
          asset_id?: number | null;
          created_at?: string;
          id?: number;
          tag_id?: number | null;
        };
        Update: {
          asset_id?: number | null;
          created_at?: string;
          id?: number;
          tag_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "assets_tag_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assets_tag_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tag";
            referencedColumns: ["id"];
          },
        ];
      };
      blocks: {
        Row: {
          __resolveType: string;
          created_at: string;
          created_by: string | null;
          id: string;
          revision: string;
          site: string;
          value: Json | null;
        };
        Insert: {
          __resolveType: string;
          created_at?: string;
          created_by?: string | null;
          id: string;
          revision?: string;
          site: string;
          value?: Json | null;
        };
        Update: {
          __resolveType?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          revision?: string;
          site?: string;
          value?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "blocks_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      configs: {
        Row: {
          archived: Json | null;
          metadata: Json | null;
          revision: string | null;
          site: string;
          state: Json | null;
          updated_at: string | null;
        };
        Insert: {
          archived?: Json | null;
          metadata?: Json | null;
          revision?: string | null;
          site: string;
          state?: Json | null;
          updated_at?: string | null;
        };
        Update: {
          archived?: Json | null;
          metadata?: Json | null;
          revision?: string | null;
          site?: string;
          state?: Json | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      connections_admin: {
        Row: {
          id: string;
          site: string | null;
          user_id: string | null;
          workspace: string | null;
        };
        Insert: {
          id?: string;
          site?: string | null;
          user_id?: string | null;
          workspace?: string | null;
        };
        Update: {
          id?: string;
          site?: string | null;
          user_id?: string | null;
          workspace?: string | null;
        };
        Relationships: [];
      };
      deco_chat_access: {
        Row: {
          allowed_roles: string[] | null;
          id: string;
          owner_id: string;
          visibility: Database["public"]["Enums"]["deco_chat_visibility_type"];
        };
        Insert: {
          allowed_roles?: string[] | null;
          id?: string;
          owner_id: string;
          visibility?: Database["public"]["Enums"]["deco_chat_visibility_type"];
        };
        Update: {
          allowed_roles?: string[] | null;
          id?: string;
          owner_id?: string;
          visibility?: Database["public"]["Enums"]["deco_chat_visibility_type"];
        };
        Relationships: [];
      };
      deco_chat_agents: {
        Row: {
          access: string | null;
          access_id: string | null;
          avatar: string;
          created_at: string;
          description: string | null;
          id: string;
          instructions: string;
          max_steps: number | null;
          max_tokens: number | null;
          memory: Json | null;
          model: string;
          name: string;
          temperature: number | null;
          tools_set: Json;
          views: Json;
          visibility: Database["public"]["Enums"]["visibility_type"];
          workspace: string;
        };
        Insert: {
          access?: string | null;
          access_id?: string | null;
          avatar: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          instructions: string;
          max_steps?: number | null;
          max_tokens?: number | null;
          memory?: Json | null;
          model: string;
          name: string;
          temperature?: number | null;
          tools_set: Json;
          views: Json;
          visibility?: Database["public"]["Enums"]["visibility_type"];
          workspace: string;
        };
        Update: {
          access?: string | null;
          access_id?: string | null;
          avatar?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          instructions?: string;
          max_steps?: number | null;
          max_tokens?: number | null;
          memory?: Json | null;
          model?: string;
          name?: string;
          temperature?: number | null;
          tools_set?: Json;
          views?: Json;
          visibility?: Database["public"]["Enums"]["visibility_type"];
          workspace?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deco_chat_agents_access_id_fkey";
            columns: ["access_id"];
            isOneToOne: false;
            referencedRelation: "deco_chat_access";
            referencedColumns: ["id"];
          },
        ];
      };
      deco_chat_api_keys: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          enabled: boolean;
          id: string;
          name: string;
          org_id: number | null;
          policies: Json | null;
          project_id: string | null;
          updated_at: string;
          workspace: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          enabled?: boolean;
          id?: string;
          name: string;
          org_id?: number | null;
          policies?: Json | null;
          project_id?: string | null;
          updated_at?: string;
          workspace: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          enabled?: boolean;
          id?: string;
          name?: string;
          org_id?: number | null;
          policies?: Json | null;
          project_id?: string | null;
          updated_at?: string;
          workspace?: string;
        };
        Relationships: [];
      };
      deco_chat_apps_registry: {
        Row: {
          connection: Json;
          created_at: string;
          description: string | null;
          friendly_name: string | null;
          icon: string | null;
          id: string;
          metadata: Json | null;
          name: string;
          org_id: number | null;
          project_id: string | null;
          scope_id: string;
          unlisted: boolean;
          updated_at: string;
          verified: boolean | null;
          workspace: string;
        };
        Insert: {
          connection: Json;
          created_at?: string;
          description?: string | null;
          friendly_name?: string | null;
          icon?: string | null;
          id?: string;
          metadata?: Json | null;
          name: string;
          org_id?: number | null;
          project_id?: string | null;
          scope_id: string;
          unlisted?: boolean;
          updated_at?: string;
          verified?: boolean | null;
          workspace: string;
        };
        Update: {
          connection?: Json;
          created_at?: string;
          description?: string | null;
          friendly_name?: string | null;
          icon?: string | null;
          id?: string;
          metadata?: Json | null;
          name?: string;
          org_id?: number | null;
          project_id?: string | null;
          scope_id?: string;
          unlisted?: boolean;
          updated_at?: string;
          verified?: boolean | null;
          workspace?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deco_chat_apps_registry_scope_id_fkey";
            columns: ["scope_id"];
            isOneToOne: false;
            referencedRelation: "deco_chat_registry_scopes";
            referencedColumns: ["id"];
          },
        ];
      };
      deco_chat_apps_registry_tools: {
        Row: {
          app_id: string;
          created_at: string;
          description: string | null;
          id: string;
          input_schema: Json | null;
          metadata: Json | null;
          name: string;
          output_schema: Json | null;
          updated_at: string;
        };
        Insert: {
          app_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          input_schema?: Json | null;
          metadata?: Json | null;
          name: string;
          output_schema?: Json | null;
          updated_at?: string;
        };
        Update: {
          app_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          input_schema?: Json | null;
          metadata?: Json | null;
          name?: string;
          output_schema?: Json | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deco_chat_apps_registry_tools_app_id_fkey";
            columns: ["app_id"];
            isOneToOne: false;
            referencedRelation: "deco_chat_apps_registry";
            referencedColumns: ["id"];
          },
        ];
      };
      deco_chat_assets: {
        Row: {
          created_at: string;
          doc_ids: string[] | null;
          file_url: string;
          filename: string | null;
          index_name: string | null;
          metadata: Json | null;
          org_id: number | null;
          path: string | null;
          project_id: string | null;
          status: string | null;
          workspace: string;
        };
        Insert: {
          created_at?: string;
          doc_ids?: string[] | null;
          file_url: string;
          filename?: string | null;
          index_name?: string | null;
          metadata?: Json | null;
          org_id?: number | null;
          path?: string | null;
          project_id?: string | null;
          status?: string | null;
          workspace: string;
        };
        Update: {
          created_at?: string;
          doc_ids?: string[] | null;
          file_url?: string;
          filename?: string | null;
          index_name?: string | null;
          metadata?: Json | null;
          org_id?: number | null;
          path?: string | null;
          project_id?: string | null;
          status?: string | null;
          workspace?: string;
        };
        Relationships: [];
      };
      deco_chat_channel_agents: {
        Row: {
          agent_id: string;
          channel_id: string;
        };
        Insert: {
          agent_id: string;
          channel_id: string;
        };
        Update: {
          agent_id?: string;
          channel_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_agent";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "deco_chat_agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_channel";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "deco_chat_channels";
            referencedColumns: ["id"];
          },
        ];
      };
      deco_chat_channels: {
        Row: {
          active: boolean;
          created_at: string;
          deleted_at: string | null;
          discriminator: string;
          id: string;
          integration_id: string;
          name: string | null;
          org_id: number | null;
          project_id: string | null;
          updated_at: string;
          workspace: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          discriminator: string;
          id?: string;
          integration_id: string;
          name?: string | null;
          org_id?: number | null;
          project_id?: string | null;
          updated_at?: string;
          workspace: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          discriminator?: string;
          id?: string;
          integration_id?: string;
          name?: string | null;
          org_id?: number | null;
          project_id?: string | null;
          updated_at?: string;
          workspace?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deco_chat_channels_integration_id_fkey";
            columns: ["integration_id"];
            isOneToOne: false;
            referencedRelation: "deco_chat_integrations";
            referencedColumns: ["id"];
          },
        ];
      };
      deco_chat_customer: {
        Row: {
          created_at: string;
          customer_id: string;
          org_id: number | null;
          project_id: string | null;
          workspace: string;
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          org_id?: number | null;
          project_id?: string | null;
          workspace: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          org_id?: number | null;
          project_id?: string | null;
          workspace?: string;
        };
        Relationships: [];
      };
      deco_chat_hosting_apps: {
        Row: {
          cloudflare_script_hash: string | null;
          cloudflare_worker_id: string | null;
          created_at: string;
          deleted_at: string | null;
          files: Json | null;
          id: string;
          metadata: Json | null;
          org_id: number | null;
          project_id: string | null;
          slug: string;
          updated_at: string;
          workspace: string;
        };
        Insert: {
          cloudflare_script_hash?: string | null;
          cloudflare_worker_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          files?: Json | null;
          id?: string;
          metadata?: Json | null;
          org_id?: number | null;
          project_id?: string | null;
          slug: string;
          updated_at?: string;
          workspace: string;
        };
        Update: {
          cloudflare_script_hash?: string | null;
          cloudflare_worker_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          files?: Json | null;
          id?: string;
          metadata?: Json | null;
          org_id?: number | null;
          project_id?: string | null;
          slug?: string;
          updated_at?: string;
          workspace?: string;
        };
        Relationships: [];
      };
      deco_chat_hosting_apps_deployments: {
        Row: {
          cloudflare_deployment_id: string | null;
          created_at: string;
          deleted_at: string | null;
          files: Json | null;
          hosting_app_id: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          cloudflare_deployment_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          files?: Json | null;
          hosting_app_id: string;
          id: string;
          updated_at?: string;
        };
        Update: {
          cloudflare_deployment_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          files?: Json | null;
          hosting_app_id?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_hosting_app_deployment";
            columns: ["hosting_app_id"];
            isOneToOne: false;
            referencedRelation: "deco_chat_hosting_apps";
            referencedColumns: ["id"];
          },
        ];
      };
      deco_chat_hosting_routes: {
        Row: {
          created_at: string;
          custom_domain: boolean;
          deleted_at: string | null;
          deployment_id: string;
          hosting_app_id: string | null;
          id: string;
          route_pattern: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          custom_domain?: boolean;
          deleted_at?: string | null;
          deployment_id: string;
          hosting_app_id?: string | null;
          id?: string;
          route_pattern: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          custom_domain?: boolean;
          deleted_at?: string | null;
          deployment_id?: string;
          hosting_app_id?: string | null;
          id?: string;
          route_pattern?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_hosting_deployment";
            columns: ["deployment_id"];
            isOneToOne: false;
            referencedRelation: "deco_chat_hosting_apps_deployments";
            referencedColumns: ["id"];
          },
        ];
      };
      deco_chat_integrations: {
        Row: {
          access: string | null;
          access_id: string | null;
          app_id: string | null;
          connection: Json;
          created_at: string;
          description: string | null;
          icon: string | null;
          id: string;
          name: string;
          workspace: string;
        };
        Insert: {
          access?: string | null;
          access_id?: string | null;
          app_id?: string | null;
          connection: Json;
          created_at?: string;
          description?: string | null;
          icon?: string | null;
          id?: string;
          name: string;
          workspace: string;
        };
        Update: {
          access?: string | null;
          access_id?: string | null;
          app_id?: string | null;
          connection?: Json;
          created_at?: string;
          description?: string | null;
          icon?: string | null;
          id?: string;
          name?: string;
          workspace?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deco_chat_integrations_access_id_fkey";
            columns: ["access_id"];
            isOneToOne: false;
            referencedRelation: "deco_chat_access";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deco_chat_integrations_app_id_fkey";
            columns: ["app_id"];
            isOneToOne: false;
            referencedRelation: "deco_chat_apps_registry";
            referencedColumns: ["id"];
          },
        ];
      };
      deco_chat_oauth_codes: {
        Row: {
          claims: Json;
          code: string;
          created_at: string;
          org_id: number | null;
          project_id: string | null;
          workspace: string;
        };
        Insert: {
          claims: Json;
          code: string;
          created_at?: string;
          org_id?: number | null;
          project_id?: string | null;
          workspace: string;
        };
        Update: {
          claims?: Json;
          code?: string;
          created_at?: string;
          org_id?: number | null;
          project_id?: string | null;
          workspace?: string;
        };
        Relationships: [];
      };
      deco_chat_plans: {
        Row: {
          created_at: string | null;
          id: string;
          markup: number;
          monthly_credit_in_dollars: number;
          title: string;
          updated_at: string | null;
          user_seats: number;
        };
        Insert: {
          created_at?: string | null;
          id: string;
          markup: number;
          monthly_credit_in_dollars: number;
          title: string;
          updated_at?: string | null;
          user_seats: number;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          markup?: number;
          monthly_credit_in_dollars?: number;
          title?: string;
          updated_at?: string | null;
          user_seats?: number;
        };
        Relationships: [];
      };
      deco_chat_projects: {
        Row: {
          created_at: string | null;
          description: string | null;
          icon: string | null;
          id: string;
          org_id: number;
          slug: string;
          title: string;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          icon?: string | null;
          id?: string;
          org_id: number;
          slug: string;
          title: string;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          icon?: string | null;
          id?: string;
          org_id?: number;
          slug?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deco_chat_projects_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      deco_chat_prompts: {
        Row: {
          content: string;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          updated_at: string | null;
          workspace: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          updated_at?: string | null;
          workspace: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          updated_at?: string | null;
          workspace?: string;
        };
        Relationships: [];
      };
      deco_chat_prompts_versions: {
        Row: {
          content: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          name: string | null;
          prompt_id: string;
          version_name: string | null;
        };
        Insert: {
          content?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string | null;
          prompt_id: string;
          version_name?: string | null;
        };
        Update: {
          content?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string | null;
          prompt_id?: string;
          version_name?: string | null;
        };
        Relationships: [];
      };
      deco_chat_registry_scopes: {
        Row: {
          created_at: string;
          id: string;
          org_id: number | null;
          project_id: string | null;
          scope_name: string;
          updated_at: string;
          workspace: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          org_id?: number | null;
          project_id?: string | null;
          scope_name: string;
          updated_at?: string;
          workspace: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          org_id?: number | null;
          project_id?: string | null;
          scope_name?: string;
          updated_at?: string;
          workspace?: string;
        };
        Relationships: [];
      };
      deco_chat_trigger_runs: {
        Row: {
          id: string;
          metadata: Json | null;
          result: Json | null;
          status: string;
          timestamp: string;
          trigger_id: string;
        };
        Insert: {
          id?: string;
          metadata?: Json | null;
          result?: Json | null;
          status: string;
          timestamp?: string;
          trigger_id: string;
        };
        Update: {
          id?: string;
          metadata?: Json | null;
          result?: Json | null;
          status?: string;
          timestamp?: string;
          trigger_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deco_chat_trigger_runs_trigger_id_fkey";
            columns: ["trigger_id"];
            isOneToOne: false;
            referencedRelation: "deco_chat_triggers";
            referencedColumns: ["id"];
          },
        ];
      };
      deco_chat_triggers: {
        Row: {
          access_id: string | null;
          active: boolean;
          agent_id: string;
          binding_id: string | null;
          created_at: string;
          id: string;
          metadata: Json;
          updated_at: string;
          user_id: string | null;
          workspace: string;
        };
        Insert: {
          access_id?: string | null;
          active?: boolean;
          agent_id: string;
          binding_id?: string | null;
          created_at?: string;
          id?: string;
          metadata: Json;
          updated_at?: string;
          user_id?: string | null;
          workspace: string;
        };
        Update: {
          access_id?: string | null;
          active?: boolean;
          agent_id?: string;
          binding_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
          updated_at?: string;
          user_id?: string | null;
          workspace?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deco_chat_triggers_access_id_fkey";
            columns: ["access_id"];
            isOneToOne: false;
            referencedRelation: "deco_chat_access";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deco_chat_triggers_binding_id_fkey";
            columns: ["binding_id"];
            isOneToOne: false;
            referencedRelation: "deco_chat_integrations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deco_chat_triggers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      deco_chat_views: {
        Row: {
          created_at: string | null;
          icon: string;
          id: string;
          integration_id: string | null;
          metadata: Json | null;
          name: string | null;
          team_id: number;
          title: string;
          type: string;
        };
        Insert: {
          created_at?: string | null;
          icon: string;
          id?: string;
          integration_id?: string | null;
          metadata?: Json | null;
          name?: string | null;
          team_id: number;
          title: string;
          type: string;
        };
        Update: {
          created_at?: string | null;
          icon?: string;
          id?: string;
          integration_id?: string | null;
          metadata?: Json | null;
          name?: string | null;
          team_id?: number;
          title?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deco_chat_views_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      deco_chat_wpp_invites: {
        Row: {
          accept_message: string;
          accepted_at: string | null;
          created_at: string;
          phone: string;
          trigger_id: string | null;
          updated_at: string | null;
          user_id: string | null;
          wpp_message_id: string;
        };
        Insert: {
          accept_message: string;
          accepted_at?: string | null;
          created_at?: string;
          phone: string;
          trigger_id?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
          wpp_message_id: string;
        };
        Update: {
          accept_message?: string;
          accepted_at?: string | null;
          created_at?: string;
          phone?: string;
          trigger_id?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
          wpp_message_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deco_chat_wpp_invites_trigger_id_fkey";
            columns: ["trigger_id"];
            isOneToOne: false;
            referencedRelation: "deco_chat_triggers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deco_chat_wpp_invites_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      deco_chat_wpp_users: {
        Row: {
          created_at: string;
          phone: string;
          trigger_id: string | null;
          trigger_url: string;
          triggers: string[];
          updated_at: string | null;
        };
        Insert: {
          created_at?: string;
          phone: string;
          trigger_id?: string | null;
          trigger_url: string;
          triggers?: string[];
          updated_at?: string | null;
        };
        Update: {
          created_at?: string;
          phone?: string;
          trigger_id?: string | null;
          trigger_url?: string;
          triggers?: string[];
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "deco_chat_wpp_users_trigger_id_fkey";
            columns: ["trigger_id"];
            isOneToOne: false;
            referencedRelation: "deco_chat_triggers";
            referencedColumns: ["id"];
          },
        ];
      };
      deco_users: {
        Row: {
          avatar: string | null;
          created_at: string;
          experts_airtable_id: string;
          id: number;
          username: string;
        };
        Insert: {
          avatar?: string | null;
          created_at?: string;
          experts_airtable_id: string;
          id?: number;
          username: string;
        };
        Update: {
          avatar?: string | null;
          created_at?: string;
          experts_airtable_id?: string;
          id?: number;
          username?: string;
        };
        Relationships: [];
      };
      "decochat-admin": {
        Row: {
          code: string | null;
          connectionId: string | null;
          created_at: string;
          id: number;
          token: string | null;
        };
        Insert: {
          code?: string | null;
          connectionId?: string | null;
          created_at?: string;
          id?: number;
          token?: string | null;
        };
        Update: {
          code?: string | null;
          connectionId?: string | null;
          created_at?: string;
          id?: number;
          token?: string | null;
        };
        Relationships: [];
      };
      domain_validation_tokens: {
        Row: {
          created_at: string;
          domain: string | null;
          id: number;
          sitename: string | null;
          uuid: string | null;
        };
        Insert: {
          created_at?: string;
          domain?: string | null;
          id?: number;
          sitename?: string | null;
          uuid?: string | null;
        };
        Update: {
          created_at?: string;
          domain?: string | null;
          id?: number;
          sitename?: string | null;
          uuid?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "domain_validation_tokens_sitename_fkey";
            columns: ["sitename"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["name"];
          },
        ];
      };
      e2e_config: {
        Row: {
          config: Json;
          created_at: string;
          id: number;
          site_id: number;
        };
        Insert: {
          config: Json;
          created_at?: string;
          id?: number;
          site_id: number;
        };
        Update: {
          config?: Json;
          created_at?: string;
          id?: number;
          site_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "e2e_config_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          _timestamp: string | null;
          api_key: string | null;
          columnno: number | null;
          delta: number | null;
          doc_encoding: string | null;
          doc_host: string | null;
          doc_path: string | null;
          doc_search: string | null;
          entries: string | null;
          error_1type: string | null;
          error_name: string | null;
          error_stack: string | null;
          error_type: string | null;
          event_type: string | null;
          eventn_ctx_event_id: string;
          flag_ab_test_page_1033: boolean | null;
          flag_ab_test_page_1128: boolean | null;
          flag_ab_test_page_1130: boolean | null;
          flag_ab_test_page_1140: boolean | null;
          flag_ab_test_page_1168: boolean | null;
          flag_ab_test_page_1170: boolean | null;
          flag_ab_test_page_1177: boolean | null;
          flag_ab_test_page_1293: boolean | null;
          flag_ab_test_page_1476: boolean | null;
          flag_ab_test_page_1487: boolean | null;
          flag_ab_test_page_1560: boolean | null;
          flag_ab_test_page_1600: boolean | null;
          flag_ab_test_page_1639: boolean | null;
          flag_ab_test_page_1659: boolean | null;
          flag_ab_test_page_1660: boolean | null;
          flag_ab_test_page_1677: boolean | null;
          flag_ab_test_page_1678: boolean | null;
          flag_ab_test_page_1679: boolean | null;
          flag_ab_test_page_1706: boolean | null;
          flag_ab_test_page_1763: boolean | null;
          flag_ab_test_page_1765: boolean | null;
          flag_ab_test_page_1769: boolean | null;
          flag_ab_test_page_1778: boolean | null;
          flag_ab_test_page_1797: boolean | null;
          flag_ab_test_page_1803: boolean | null;
          flag_ab_test_page_1806: boolean | null;
          flag_ab_test_page_1815: boolean | null;
          flag_ab_test_page_1848: boolean | null;
          flag_ab_test_page_1861: boolean | null;
          flag_ab_test_page_2026: boolean | null;
          flag_ab_test_page_2041: boolean | null;
          flag_ab_test_page_2050: boolean | null;
          flag_ab_test_page_2137: boolean | null;
          flag_ab_test_page_2144: boolean | null;
          flag_ab_test_page_2147: boolean | null;
          flag_ab_test_page_545: boolean | null;
          flag_ab_test_page_603: boolean | null;
          flag_ab_test_page_622: boolean | null;
          flag_ab_test_page_892: boolean | null;
          flag_ab_test_page_922: boolean | null;
          flag_ab_test_page_951: boolean | null;
          flag_ab_test_page_954: boolean | null;
          flag_ab_test_page_969: boolean | null;
          flag_ab_test_page_983: boolean | null;
          flag_ab_test_page_984: boolean | null;
          flag_ab_test_page_993: boolean | null;
          flag_ab_test_page_994: boolean | null;
          flag_ab_test_page_996: boolean | null;
          flag_ab_test_page_999: boolean | null;
          flag_show_globe: boolean | null;
          id: string | null;
          ids_ga: string | null;
          lineno: number | null;
          local_tz_offset: number | null;
          location_city: string | null;
          location_continent: string | null;
          location_country: string | null;
          location_country_name: string | null;
          location_latitude: number | null;
          location_longitude: number | null;
          location_region: string | null;
          location_zip: string | null;
          message: string | null;
          name: string | null;
          navigationtype: string | null;
          page_id: string | null;
          page_path: string | null;
          page_title: string | null;
          pageid: string | null;
          pagepath: string | null;
          parsed_ua_bot: boolean | null;
          parsed_ua_device_brand: string | null;
          parsed_ua_device_family: string | null;
          parsed_ua_device_model: string | null;
          parsed_ua_os_family: string | null;
          parsed_ua_os_version: string | null;
          parsed_ua_ua_family: string | null;
          parsed_ua_ua_version: string | null;
          publish_type: string | null;
          published_page_id: number | null;
          rating: string | null;
          referer: string | null;
          saved_page_id: number | null;
          screen_resolution: string | null;
          section_id: string | null;
          section_label: string | null;
          sectionid: string | null;
          sectionlabe: string | null;
          site_id: string | null;
          source_ip: string | null;
          src: string | null;
          url: string | null;
          usage_type: string | null;
          user_agent: string | null;
          user_anonymous_id: string | null;
          user_hashed_anonymous_id: string | null;
          user_language: string | null;
          utc_time: string | null;
          value: number | null;
          vp_size: string | null;
        };
        Insert: {
          _timestamp?: string | null;
          api_key?: string | null;
          columnno?: number | null;
          delta?: number | null;
          doc_encoding?: string | null;
          doc_host?: string | null;
          doc_path?: string | null;
          doc_search?: string | null;
          entries?: string | null;
          error_1type?: string | null;
          error_name?: string | null;
          error_stack?: string | null;
          error_type?: string | null;
          event_type?: string | null;
          eventn_ctx_event_id?: string;
          flag_ab_test_page_1033?: boolean | null;
          flag_ab_test_page_1128?: boolean | null;
          flag_ab_test_page_1130?: boolean | null;
          flag_ab_test_page_1140?: boolean | null;
          flag_ab_test_page_1168?: boolean | null;
          flag_ab_test_page_1170?: boolean | null;
          flag_ab_test_page_1177?: boolean | null;
          flag_ab_test_page_1293?: boolean | null;
          flag_ab_test_page_1476?: boolean | null;
          flag_ab_test_page_1487?: boolean | null;
          flag_ab_test_page_1560?: boolean | null;
          flag_ab_test_page_1600?: boolean | null;
          flag_ab_test_page_1639?: boolean | null;
          flag_ab_test_page_1659?: boolean | null;
          flag_ab_test_page_1660?: boolean | null;
          flag_ab_test_page_1677?: boolean | null;
          flag_ab_test_page_1678?: boolean | null;
          flag_ab_test_page_1679?: boolean | null;
          flag_ab_test_page_1706?: boolean | null;
          flag_ab_test_page_1763?: boolean | null;
          flag_ab_test_page_1765?: boolean | null;
          flag_ab_test_page_1769?: boolean | null;
          flag_ab_test_page_1778?: boolean | null;
          flag_ab_test_page_1797?: boolean | null;
          flag_ab_test_page_1803?: boolean | null;
          flag_ab_test_page_1806?: boolean | null;
          flag_ab_test_page_1815?: boolean | null;
          flag_ab_test_page_1848?: boolean | null;
          flag_ab_test_page_1861?: boolean | null;
          flag_ab_test_page_2026?: boolean | null;
          flag_ab_test_page_2041?: boolean | null;
          flag_ab_test_page_2050?: boolean | null;
          flag_ab_test_page_2137?: boolean | null;
          flag_ab_test_page_2144?: boolean | null;
          flag_ab_test_page_2147?: boolean | null;
          flag_ab_test_page_545?: boolean | null;
          flag_ab_test_page_603?: boolean | null;
          flag_ab_test_page_622?: boolean | null;
          flag_ab_test_page_892?: boolean | null;
          flag_ab_test_page_922?: boolean | null;
          flag_ab_test_page_951?: boolean | null;
          flag_ab_test_page_954?: boolean | null;
          flag_ab_test_page_969?: boolean | null;
          flag_ab_test_page_983?: boolean | null;
          flag_ab_test_page_984?: boolean | null;
          flag_ab_test_page_993?: boolean | null;
          flag_ab_test_page_994?: boolean | null;
          flag_ab_test_page_996?: boolean | null;
          flag_ab_test_page_999?: boolean | null;
          flag_show_globe?: boolean | null;
          id?: string | null;
          ids_ga?: string | null;
          lineno?: number | null;
          local_tz_offset?: number | null;
          location_city?: string | null;
          location_continent?: string | null;
          location_country?: string | null;
          location_country_name?: string | null;
          location_latitude?: number | null;
          location_longitude?: number | null;
          location_region?: string | null;
          location_zip?: string | null;
          message?: string | null;
          name?: string | null;
          navigationtype?: string | null;
          page_id?: string | null;
          page_path?: string | null;
          page_title?: string | null;
          pageid?: string | null;
          pagepath?: string | null;
          parsed_ua_bot?: boolean | null;
          parsed_ua_device_brand?: string | null;
          parsed_ua_device_family?: string | null;
          parsed_ua_device_model?: string | null;
          parsed_ua_os_family?: string | null;
          parsed_ua_os_version?: string | null;
          parsed_ua_ua_family?: string | null;
          parsed_ua_ua_version?: string | null;
          publish_type?: string | null;
          published_page_id?: number | null;
          rating?: string | null;
          referer?: string | null;
          saved_page_id?: number | null;
          screen_resolution?: string | null;
          section_id?: string | null;
          section_label?: string | null;
          sectionid?: string | null;
          sectionlabe?: string | null;
          site_id?: string | null;
          source_ip?: string | null;
          src?: string | null;
          url?: string | null;
          usage_type?: string | null;
          user_agent?: string | null;
          user_anonymous_id?: string | null;
          user_hashed_anonymous_id?: string | null;
          user_language?: string | null;
          utc_time?: string | null;
          value?: number | null;
          vp_size?: string | null;
        };
        Update: {
          _timestamp?: string | null;
          api_key?: string | null;
          columnno?: number | null;
          delta?: number | null;
          doc_encoding?: string | null;
          doc_host?: string | null;
          doc_path?: string | null;
          doc_search?: string | null;
          entries?: string | null;
          error_1type?: string | null;
          error_name?: string | null;
          error_stack?: string | null;
          error_type?: string | null;
          event_type?: string | null;
          eventn_ctx_event_id?: string;
          flag_ab_test_page_1033?: boolean | null;
          flag_ab_test_page_1128?: boolean | null;
          flag_ab_test_page_1130?: boolean | null;
          flag_ab_test_page_1140?: boolean | null;
          flag_ab_test_page_1168?: boolean | null;
          flag_ab_test_page_1170?: boolean | null;
          flag_ab_test_page_1177?: boolean | null;
          flag_ab_test_page_1293?: boolean | null;
          flag_ab_test_page_1476?: boolean | null;
          flag_ab_test_page_1487?: boolean | null;
          flag_ab_test_page_1560?: boolean | null;
          flag_ab_test_page_1600?: boolean | null;
          flag_ab_test_page_1639?: boolean | null;
          flag_ab_test_page_1659?: boolean | null;
          flag_ab_test_page_1660?: boolean | null;
          flag_ab_test_page_1677?: boolean | null;
          flag_ab_test_page_1678?: boolean | null;
          flag_ab_test_page_1679?: boolean | null;
          flag_ab_test_page_1706?: boolean | null;
          flag_ab_test_page_1763?: boolean | null;
          flag_ab_test_page_1765?: boolean | null;
          flag_ab_test_page_1769?: boolean | null;
          flag_ab_test_page_1778?: boolean | null;
          flag_ab_test_page_1797?: boolean | null;
          flag_ab_test_page_1803?: boolean | null;
          flag_ab_test_page_1806?: boolean | null;
          flag_ab_test_page_1815?: boolean | null;
          flag_ab_test_page_1848?: boolean | null;
          flag_ab_test_page_1861?: boolean | null;
          flag_ab_test_page_2026?: boolean | null;
          flag_ab_test_page_2041?: boolean | null;
          flag_ab_test_page_2050?: boolean | null;
          flag_ab_test_page_2137?: boolean | null;
          flag_ab_test_page_2144?: boolean | null;
          flag_ab_test_page_2147?: boolean | null;
          flag_ab_test_page_545?: boolean | null;
          flag_ab_test_page_603?: boolean | null;
          flag_ab_test_page_622?: boolean | null;
          flag_ab_test_page_892?: boolean | null;
          flag_ab_test_page_922?: boolean | null;
          flag_ab_test_page_951?: boolean | null;
          flag_ab_test_page_954?: boolean | null;
          flag_ab_test_page_969?: boolean | null;
          flag_ab_test_page_983?: boolean | null;
          flag_ab_test_page_984?: boolean | null;
          flag_ab_test_page_993?: boolean | null;
          flag_ab_test_page_994?: boolean | null;
          flag_ab_test_page_996?: boolean | null;
          flag_ab_test_page_999?: boolean | null;
          flag_show_globe?: boolean | null;
          id?: string | null;
          ids_ga?: string | null;
          lineno?: number | null;
          local_tz_offset?: number | null;
          location_city?: string | null;
          location_continent?: string | null;
          location_country?: string | null;
          location_country_name?: string | null;
          location_latitude?: number | null;
          location_longitude?: number | null;
          location_region?: string | null;
          location_zip?: string | null;
          message?: string | null;
          name?: string | null;
          navigationtype?: string | null;
          page_id?: string | null;
          page_path?: string | null;
          page_title?: string | null;
          pageid?: string | null;
          pagepath?: string | null;
          parsed_ua_bot?: boolean | null;
          parsed_ua_device_brand?: string | null;
          parsed_ua_device_family?: string | null;
          parsed_ua_device_model?: string | null;
          parsed_ua_os_family?: string | null;
          parsed_ua_os_version?: string | null;
          parsed_ua_ua_family?: string | null;
          parsed_ua_ua_version?: string | null;
          publish_type?: string | null;
          published_page_id?: number | null;
          rating?: string | null;
          referer?: string | null;
          saved_page_id?: number | null;
          screen_resolution?: string | null;
          section_id?: string | null;
          section_label?: string | null;
          sectionid?: string | null;
          sectionlabe?: string | null;
          site_id?: string | null;
          source_ip?: string | null;
          src?: string | null;
          url?: string | null;
          usage_type?: string | null;
          user_agent?: string | null;
          user_anonymous_id?: string | null;
          user_hashed_anonymous_id?: string | null;
          user_language?: string | null;
          utc_time?: string | null;
          value?: number | null;
          vp_size?: string | null;
        };
        Relationships: [];
      };
      experiments: {
        Row: {
          createdBy: string | null;
          custom_goals: string[] | null;
          description: string | null;
          endedAt: string | null;
          id: number;
          name: string | null;
          site: string | null;
          startedAt: string;
          status: string | null;
          variants: Json | null;
        };
        Insert: {
          createdBy?: string | null;
          custom_goals?: string[] | null;
          description?: string | null;
          endedAt?: string | null;
          id?: number;
          name?: string | null;
          site?: string | null;
          startedAt?: string;
          status?: string | null;
          variants?: Json | null;
        };
        Update: {
          createdBy?: string | null;
          custom_goals?: string[] | null;
          description?: string | null;
          endedAt?: string | null;
          id?: number;
          name?: string | null;
          site?: string | null;
          startedAt?: string;
          status?: string | null;
          variants?: Json | null;
        };
        Relationships: [];
      };
      expert_praises: {
        Row: {
          content: string | null;
          created_at: string;
          created_by: number | null;
          id: number;
          user_id: number | null;
        };
        Insert: {
          content?: string | null;
          created_at?: string;
          created_by?: number | null;
          id?: number;
          user_id?: number | null;
        };
        Update: {
          content?: string | null;
          created_at?: string;
          created_by?: number | null;
          id?: number;
          user_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "public_expert_praises_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "deco_users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "public_expert_praises_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "deco_users";
            referencedColumns: ["id"];
          },
        ];
      };
      flags: {
        Row: {
          created_at: string | null;
          data: Json | null;
          description: string | null;
          id: number;
          key: string | null;
          name: string | null;
          site: number | null;
          state: string;
          updated_at: string | null;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string | null;
          data?: Json | null;
          description?: string | null;
          id?: number;
          key?: string | null;
          name?: string | null;
          site?: number | null;
          state?: string;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string | null;
          data?: Json | null;
          description?: string | null;
          id?: number;
          key?: string | null;
          name?: string | null;
          site?: number | null;
          state?: string;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "flags_site_fkey";
            columns: ["site"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "flags_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      form_submission: {
        Row: {
          created_at: string | null;
          data: Json | null;
          id: number;
          site_id: number;
        };
        Insert: {
          created_at?: string | null;
          data?: Json | null;
          id?: number;
          site_id: number;
        };
        Update: {
          created_at?: string | null;
          data?: Json | null;
          id?: number;
          site_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "form_submission_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
      invites: {
        Row: {
          created_at: string;
          id: string;
          invited_email: string;
          invited_roles: Json[] | null;
          inviter_id: string;
          team_id: number;
          team_name: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          invited_email: string;
          invited_roles?: Json[] | null;
          inviter_id: string;
          team_id: number;
          team_name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          invited_email?: string;
          invited_roles?: Json[] | null;
          inviter_id?: string;
          team_id?: number;
          team_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invites_inviter_id_fkey";
            columns: ["inviter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "invites_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          bank_slip_url: string | null;
          description: string | null;
          due_date: string | null;
          id: number;
          invoice_id: number | null;
          nf_url: string | null;
          reference_month: string | null;
          status: string | null;
          team: string | null;
          value: number | null;
        };
        Insert: {
          bank_slip_url?: string | null;
          description?: string | null;
          due_date?: string | null;
          id: number;
          invoice_id?: number | null;
          nf_url?: string | null;
          reference_month?: string | null;
          status?: string | null;
          team?: string | null;
          value?: number | null;
        };
        Update: {
          bank_slip_url?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: number;
          invoice_id?: number | null;
          nf_url?: string | null;
          reference_month?: string | null;
          status?: string | null;
          team?: string | null;
          value?: number | null;
        };
        Relationships: [];
      };
      latency: {
        Row: {
          created_at: string;
          id: number;
          p50: number | null;
          p95: number | null;
          p99: number | null;
          visits_12h: number | null;
          website: string | null;
        };
        Insert: {
          created_at?: string;
          id?: number;
          p50?: number | null;
          p95?: number | null;
          p99?: number | null;
          visits_12h?: number | null;
          website?: string | null;
        };
        Update: {
          created_at?: string;
          id?: number;
          p50?: number | null;
          p95?: number | null;
          p99?: number | null;
          visits_12h?: number | null;
          website?: string | null;
        };
        Relationships: [];
      };
      listen_test: {
        Row: {
          created_at: string;
          id: number;
          user_id: number | null;
        };
        Insert: {
          created_at?: string;
          id?: number;
          user_id?: number | null;
        };
        Update: {
          created_at?: string;
          id?: number;
          user_id?: number | null;
        };
        Relationships: [];
      };
      mcp_wallet_tokens: {
        Row: {
          created_at: string;
          mcp_id: string;
          token: string;
        };
        Insert: {
          created_at?: string;
          mcp_id: string;
          token: string;
        };
        Update: {
          created_at?: string;
          mcp_id?: string;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mcp_wallet_tokens_mcp_id_fkey";
            columns: ["mcp_id"];
            isOneToOne: false;
            referencedRelation: "mcp_wallets";
            referencedColumns: ["id"];
          },
        ];
      };
      mcp_wallets: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          owner_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          owner_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          owner_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mcp_wallets_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      member_roles: {
        Row: {
          created_at: string;
          id: number;
          member_id: number;
          role_id: number;
        };
        Insert: {
          created_at?: string;
          id?: number;
          member_id: number;
          role_id: number;
        };
        Update: {
          created_at?: string;
          id?: number;
          member_id?: number;
          role_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "member_roles_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_roles_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      members: {
        Row: {
          activity: Json[] | null;
          admin: boolean | null;
          created_at: string | null;
          deleted_at: string | null;
          id: number;
          stripe_customer_id: string | null;
          team_id: number | null;
          user_id: string | null;
        };
        Insert: {
          activity?: Json[] | null;
          admin?: boolean | null;
          created_at?: string | null;
          deleted_at?: string | null;
          id?: number;
          stripe_customer_id?: string | null;
          team_id?: number | null;
          user_id?: string | null;
        };
        Update: {
          activity?: Json[] | null;
          admin?: boolean | null;
          created_at?: string | null;
          deleted_at?: string | null;
          id?: number;
          stripe_customer_id?: string | null;
          team_id?: number | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "members_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      models: {
        Row: {
          api_key_hash: string | null;
          by_deco: boolean;
          created_at: string;
          description: string | null;
          id: string;
          is_enabled: boolean;
          model: string;
          name: string;
          updated_at: string;
          workspace: string;
        };
        Insert: {
          api_key_hash?: string | null;
          by_deco?: boolean;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_enabled?: boolean;
          model: string;
          name: string;
          updated_at?: string;
          workspace: string;
        };
        Update: {
          api_key_hash?: string | null;
          by_deco?: boolean;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_enabled?: boolean;
          model?: string;
          name?: string;
          updated_at?: string;
          workspace?: string;
        };
        Relationships: [];
      };
      pages: {
        Row: {
          created_at: string | null;
          data: Json | null;
          example_path: string | null;
          id: number;
          name: string | null;
          path: string | null;
          public: boolean | null;
          site: number | null;
          state: string;
          thumb_url: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string | null;
          data?: Json | null;
          example_path?: string | null;
          id?: number;
          name?: string | null;
          path?: string | null;
          public?: boolean | null;
          site?: number | null;
          state?: string;
          thumb_url?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string | null;
          data?: Json | null;
          example_path?: string | null;
          id?: number;
          name?: string | null;
          path?: string | null;
          public?: boolean | null;
          site?: number | null;
          state?: string;
          thumb_url?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pages_site_fkey";
            columns: ["site"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pages_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      pagespeeds: {
        Row: {
          pagespeed: Json | null;
          site: string;
          timestamp: string;
        };
        Insert: {
          pagespeed?: Json | null;
          site: string;
          timestamp: string;
        };
        Update: {
          pagespeed?: Json | null;
          site?: string;
          timestamp?: string;
        };
        Relationships: [
          {
            foreignKeyName: "public_pagespeeds_site_fkey";
            columns: ["site"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["name"];
          },
        ];
      };
      permissions: {
        Row: {
          action: string;
          created_at: string;
          id: number;
          role_id: number;
          type: string;
        };
        Insert: {
          action: string;
          created_at?: string;
          id?: number;
          role_id: number;
          type: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          id?: number;
          role_id?: number;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "permissions_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          currency: string | null;
          discount: number | null;
          fixed_price: number | null;
          gmv_threshold: number | null;
          id: number;
          included_bw: number | null;
          included_bw_per_10k_pageviews: number | null;
          included_pageviews: number | null;
          included_requests_per_10k_pageviews: number | null;
          name: string | null;
          performance_bonus: number | null;
          plan_id: string | null;
          price_extra_1gb_bw_after_included_per_10k_pageviews: number | null;
          price_extra_1k_requests_after_included_per_10k_pageviews:
            | number
            | null;
          price_per_10k: number | null;
          price_per_additional_1gb_bw: number | null;
          price_review: number | null;
          takerate_gmv: number | null;
        };
        Insert: {
          currency?: string | null;
          discount?: number | null;
          fixed_price?: number | null;
          gmv_threshold?: number | null;
          id: number;
          included_bw?: number | null;
          included_bw_per_10k_pageviews?: number | null;
          included_pageviews?: number | null;
          included_requests_per_10k_pageviews?: number | null;
          name?: string | null;
          performance_bonus?: number | null;
          plan_id?: string | null;
          price_extra_1gb_bw_after_included_per_10k_pageviews?: number | null;
          price_extra_1k_requests_after_included_per_10k_pageviews?:
            | number
            | null;
          price_per_10k?: number | null;
          price_per_additional_1gb_bw?: number | null;
          price_review?: number | null;
          takerate_gmv?: number | null;
        };
        Update: {
          currency?: string | null;
          discount?: number | null;
          fixed_price?: number | null;
          gmv_threshold?: number | null;
          id?: number;
          included_bw?: number | null;
          included_bw_per_10k_pageviews?: number | null;
          included_pageviews?: number | null;
          included_requests_per_10k_pageviews?: number | null;
          name?: string | null;
          performance_bonus?: number | null;
          plan_id?: string | null;
          price_extra_1gb_bw_after_included_per_10k_pageviews?: number | null;
          price_extra_1k_requests_after_included_per_10k_pageviews?:
            | number
            | null;
          price_per_10k?: number | null;
          price_per_additional_1gb_bw?: number | null;
          price_review?: number | null;
          takerate_gmv?: number | null;
        };
        Relationships: [];
      };
      policies: {
        Row: {
          created_at: string;
          description: string | null;
          id: number;
          name: string;
          statements: Json[];
          team_id: number | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: number;
          name: string;
          statements: Json[];
          team_id?: number | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: number;
          name?: string;
          statements?: Json[];
          team_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "policies_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string | null;
          deco_user_id: number | null;
          email: string;
          id: number;
          is_new_user: boolean | null;
          name: string | null;
          phone: string | null;
          phone_verified_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          deco_user_id?: number | null;
          email: string;
          id?: number;
          is_new_user?: boolean | null;
          name?: string | null;
          phone?: string | null;
          phone_verified_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          deco_user_id?: number | null;
          email?: string;
          id?: number;
          is_new_user?: boolean | null;
          name?: string | null;
          phone?: string | null;
          phone_verified_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users_meta_data_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "public_profiles_deco_user_id_fkey";
            columns: ["deco_user_id"];
            isOneToOne: false;
            referencedRelation: "deco_users";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          created_at: string | null;
          created_from: number | null;
          id: number;
          metadata: Json | null;
          name: string;
          public: boolean | null;
          team: number | null;
        };
        Insert: {
          created_at?: string | null;
          created_from?: number | null;
          id?: number;
          metadata?: Json | null;
          name: string;
          public?: boolean | null;
          team?: number | null;
        };
        Update: {
          created_at?: string | null;
          created_from?: number | null;
          id?: number;
          metadata?: Json | null;
          name?: string;
          public?: boolean | null;
          team?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "projects_created_from_fkey";
            columns: ["created_from"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_team_fkey";
            columns: ["team"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      role_policies: {
        Row: {
          created_at: string;
          id: number;
          policy_id: number;
          role_id: number;
        };
        Insert: {
          created_at?: string;
          id?: number;
          policy_id: number;
          role_id: number;
        };
        Update: {
          created_at?: string;
          id?: number;
          policy_id?: number;
          role_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "RolePolicies_policy_id_fkey";
            columns: ["policy_id"];
            isOneToOne: false;
            referencedRelation: "policies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "RolePolicies_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      roles: {
        Row: {
          created_at: string;
          description: string | null;
          id: number;
          name: string;
          statements: Json[] | null;
          team_id: number | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: number;
          name: string;
          statements?: Json[] | null;
          team_id?: number | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: number;
          name?: string;
          statements?: Json[] | null;
          team_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "roles_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      scrap: {
        Row: {
          banners: string | null;
          categories: string | null;
          colors: string | null;
          created_at: string | null;
          domain: string;
          favicon: string | null;
          logos: string | null;
          seo: string | null;
          themeColor: string | null;
          title: string | null;
          vtexconfig: string | null;
        };
        Insert: {
          banners?: string | null;
          categories?: string | null;
          colors?: string | null;
          created_at?: string | null;
          domain: string;
          favicon?: string | null;
          logos?: string | null;
          seo?: string | null;
          themeColor?: string | null;
          title?: string | null;
          vtexconfig?: string | null;
        };
        Update: {
          banners?: string | null;
          categories?: string | null;
          colors?: string | null;
          created_at?: string | null;
          domain?: string;
          favicon?: string | null;
          logos?: string | null;
          seo?: string | null;
          themeColor?: string | null;
          title?: string | null;
          vtexconfig?: string | null;
        };
        Relationships: [];
      };
      site_metrics: {
        Row: {
          bounce_rate: number | null;
          cpu_seconds: number | null;
          date: string;
          kv_read_count: number | null;
          kv_read_units: number | null;
          kv_write_count: number | null;
          kv_write_units: number | null;
          max_rss_memory_bytes: number | null;
          network_egress_bytes: number | null;
          network_ingress_bytes: number | null;
          pageviews: number | null;
          request_count: number | null;
          site: string;
          team: number | null;
          uptime_seconds: number | null;
          visit_duration: number | null;
          visitors: number | null;
        };
        Insert: {
          bounce_rate?: number | null;
          cpu_seconds?: number | null;
          date: string;
          kv_read_count?: number | null;
          kv_read_units?: number | null;
          kv_write_count?: number | null;
          kv_write_units?: number | null;
          max_rss_memory_bytes?: number | null;
          network_egress_bytes?: number | null;
          network_ingress_bytes?: number | null;
          pageviews?: number | null;
          request_count?: number | null;
          site: string;
          team?: number | null;
          uptime_seconds?: number | null;
          visit_duration?: number | null;
          visitors?: number | null;
        };
        Update: {
          bounce_rate?: number | null;
          cpu_seconds?: number | null;
          date?: string;
          kv_read_count?: number | null;
          kv_read_units?: number | null;
          kv_write_count?: number | null;
          kv_write_units?: number | null;
          max_rss_memory_bytes?: number | null;
          network_egress_bytes?: number | null;
          network_ingress_bytes?: number | null;
          pageviews?: number | null;
          request_count?: number | null;
          site?: string;
          team?: number | null;
          uptime_seconds?: number | null;
          visit_duration?: number | null;
          visitors?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "site_metrics_team_fkey";
            columns: ["team"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      sites: {
        Row: {
          capture_logs: boolean;
          created_at: string | null;
          created_from: number | null;
          deno_project_id: string | null;
          deployments: Json | null;
          domains: Json;
          favicon_cache: string | null;
          full_name: string | null;
          github_repo_url: string | null;
          id: number;
          is_template: boolean;
          metadata: Json | null;
          name: string;
          pagespeed: Json | null;
          public: boolean | null;
          site_creation_error: Json | null;
          team: number | null;
          test_e2e: boolean;
          thumb_url: string | null;
        };
        Insert: {
          capture_logs?: boolean;
          created_at?: string | null;
          created_from?: number | null;
          deno_project_id?: string | null;
          deployments?: Json | null;
          domains?: Json;
          favicon_cache?: string | null;
          full_name?: string | null;
          github_repo_url?: string | null;
          id?: number;
          is_template?: boolean;
          metadata?: Json | null;
          name: string;
          pagespeed?: Json | null;
          public?: boolean | null;
          site_creation_error?: Json | null;
          team?: number | null;
          test_e2e?: boolean;
          thumb_url?: string | null;
        };
        Update: {
          capture_logs?: boolean;
          created_at?: string | null;
          created_from?: number | null;
          deno_project_id?: string | null;
          deployments?: Json | null;
          domains?: Json;
          favicon_cache?: string | null;
          full_name?: string | null;
          github_repo_url?: string | null;
          id?: number;
          is_template?: boolean;
          metadata?: Json | null;
          name?: string;
          pagespeed?: Json | null;
          public?: boolean | null;
          site_creation_error?: Json | null;
          team?: number | null;
          test_e2e?: boolean;
          thumb_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sites_created_from_fkey";
            columns: ["created_from"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sites_team_fkey";
            columns: ["team"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      sites_metadata: {
        Row: {
          created_at: string;
          id: number;
          metadata: Json;
        };
        Insert: {
          created_at?: string;
          id?: number;
          metadata: Json;
        };
        Update: {
          created_at?: string;
          id?: number;
          metadata?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "sites_metadata_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
      students: {
        Row: {
          referral_id: string | null;
          referrals_count: number;
          referred_by: string | null;
          student_id: number;
          university_id: number;
        };
        Insert: {
          referral_id?: string | null;
          referrals_count?: number;
          referred_by?: string | null;
          student_id: number;
          university_id: number;
        };
        Update: {
          referral_id?: string | null;
          referrals_count?: number;
          referred_by?: string | null;
          student_id?: number;
          university_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "students_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "students_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          customer_details: Json | null;
          go_live_date: string | null;
          id: string;
          plan: number | null;
          signed_date: string | null;
          status: string | null;
          tax_id: string | null;
          team: number | null;
        };
        Insert: {
          customer_details?: Json | null;
          go_live_date?: string | null;
          id?: string;
          plan?: number | null;
          signed_date?: string | null;
          status?: string | null;
          tax_id?: string | null;
          team?: number | null;
        };
        Update: {
          customer_details?: Json | null;
          go_live_date?: string | null;
          id?: string;
          plan?: number | null;
          signed_date?: string | null;
          status?: string | null;
          tax_id?: string | null;
          team?: number | null;
        };
        Relationships: [];
      };
      tag: {
        Row: {
          color: string;
          created_at: string;
          id: number;
          label: string;
        };
        Insert: {
          color: string;
          created_at?: string;
          id?: number;
          label: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          id?: number;
          label?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          created_at: string;
          data: Json | null;
          expires_at: string | null;
          last_failure: string | null;
          name: string;
          queue: string | null;
          result: Json | null;
          retries: number | null;
          site: string;
          state: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string;
          data?: Json | null;
          expires_at?: string | null;
          last_failure?: string | null;
          name: string;
          queue?: string | null;
          result?: Json | null;
          retries?: number | null;
          site: string;
          state?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string;
          data?: Json | null;
          expires_at?: string | null;
          last_failure?: string | null;
          name?: string;
          queue?: string | null;
          result?: Json | null;
          retries?: number | null;
          site?: string;
          state?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_site_fkey";
            columns: ["site"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["name"];
          },
        ];
      };
      team_access_suspension: {
        Row: {
          created_at: string;
          id: number;
          is_active: boolean;
          suspended_at: string;
          suspended_reason: string;
          team_id: number;
        };
        Insert: {
          created_at?: string;
          id?: number;
          is_active?: boolean;
          suspended_at: string;
          suspended_reason: string;
          team_id: number;
        };
        Update: {
          created_at?: string;
          id?: number;
          is_active?: boolean;
          suspended_at?: string;
          suspended_reason?: string;
          team_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "team_blocks_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: true;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      team_overdue_warning: {
        Row: {
          acknowledged_at: string | null;
          created_at: string;
          expected_access_suspension: string;
          id: number;
          is_active: boolean;
          overdue_invoices: number[];
          team_id: number;
          warned_at: string;
        };
        Insert: {
          acknowledged_at?: string | null;
          created_at?: string;
          expected_access_suspension: string;
          id?: number;
          is_active?: boolean;
          overdue_invoices: number[];
          team_id: number;
          warned_at: string;
        };
        Update: {
          acknowledged_at?: string | null;
          created_at?: string;
          expected_access_suspension?: string;
          id?: number;
          is_active?: boolean;
          overdue_invoices?: number[];
          team_id?: number;
          warned_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_overdue_warning_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      teams: {
        Row: {
          created_at: string | null;
          id: number;
          name: string;
          plan: string | null;
          plan_id: string;
          slug: string | null;
          stripe_subscription_id: string | null;
          theme: Json | null;
        };
        Insert: {
          created_at?: string | null;
          id?: number;
          name: string;
          plan?: string | null;
          plan_id?: string;
          slug?: string | null;
          stripe_subscription_id?: string | null;
          theme?: Json | null;
        };
        Update: {
          created_at?: string | null;
          id?: number;
          name?: string;
          plan?: string | null;
          plan_id?: string;
          slug?: string | null;
          stripe_subscription_id?: string | null;
          theme?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "teams_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "deco_chat_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      temp_webdraw_community_apps: {
        Row: {
          allow_fork: boolean | null;
          content: string;
          created_at: string;
          icon_url: string | null;
          id: number;
          link: string;
          medias: Json[] | null;
          milestones: Json | null;
          short_description: string | null;
          slug: string;
          title: string;
          uid: string | null;
          updated_at: string;
          user_id: string;
          views: number;
          visibility: string;
        };
        Insert: {
          allow_fork?: boolean | null;
          content: string;
          created_at?: string;
          icon_url?: string | null;
          id?: number;
          link: string;
          medias?: Json[] | null;
          milestones?: Json | null;
          short_description?: string | null;
          slug: string;
          title: string;
          uid?: string | null;
          updated_at: string;
          user_id: string;
          views: number;
          visibility?: string;
        };
        Update: {
          allow_fork?: boolean | null;
          content?: string;
          created_at?: string;
          icon_url?: string | null;
          id?: number;
          link?: string;
          medias?: Json[] | null;
          milestones?: Json | null;
          short_description?: string | null;
          slug?: string;
          title?: string;
          uid?: string | null;
          updated_at?: string;
          user_id?: string;
          views?: number;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "temp_webdraw_community_apps_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "temp_webdraw_community_apps_user_id_fkey1";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "webdraw_user_metadata";
            referencedColumns: ["user_id"];
          },
        ];
      };
      tokens: {
        Row: {
          created_at: string;
          credits: Json | null;
          token: string;
        };
        Insert: {
          created_at?: string;
          credits?: Json | null;
          token?: string;
        };
        Update: {
          created_at?: string;
          credits?: Json | null;
          token?: string;
        };
        Relationships: [];
      };
      universities: {
        Row: {
          acronym: string | null;
          created_at: string;
          domains: string[] | null;
          id: number;
          name: string | null;
          quantity: number | null;
          quantity_updated_at: string | null;
        };
        Insert: {
          acronym?: string | null;
          created_at?: string;
          domains?: string[] | null;
          id?: number;
          name?: string | null;
          quantity?: number | null;
          quantity_updated_at?: string | null;
        };
        Update: {
          acronym?: string | null;
          created_at?: string;
          domains?: string[] | null;
          id?: number;
          name?: string | null;
          quantity?: number | null;
          quantity_updated_at?: string | null;
        };
        Relationships: [];
      };
      url_metadata_cache: {
        Row: {
          created_at: string;
          creator_token: string | null;
          data: Json | null;
          id: number;
          url: string | null;
        };
        Insert: {
          created_at?: string;
          creator_token?: string | null;
          data?: Json | null;
          id?: number;
          url?: string | null;
        };
        Update: {
          created_at?: string;
          creator_token?: string | null;
          data?: Json | null;
          id?: number;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "url_metadata_cache_creator_token_fkey";
            columns: ["creator_token"];
            isOneToOne: false;
            referencedRelation: "tokens";
            referencedColumns: ["token"];
          },
        ];
      };
      user_activity: {
        Row: {
          created_at: string;
          id: number;
          key: string | null;
          resource: string;
          user_id: string;
          value: string | null;
        };
        Insert: {
          created_at?: string;
          id?: number;
          key?: string | null;
          resource: string;
          user_id: string;
          value?: string | null;
        };
        Update: {
          created_at?: string;
          id?: number;
          key?: string | null;
          resource?: string;
          user_id?: string;
          value?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_opened_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      vendors: {
        Row: {
          alias: string;
          created_at: string;
          id: number;
          team_id: number;
          url: string;
        };
        Insert: {
          alias: string;
          created_at?: string;
          id?: number;
          team_id: number;
          url: string;
        };
        Update: {
          alias?: string;
          created_at?: string;
          id?: number;
          team_id?: number;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vendors_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      waitlist_deco_3: {
        Row: {
          created_at: string;
          email: string;
        };
        Insert: {
          created_at?: string;
          email: string;
        };
        Update: {
          created_at?: string;
          email?: string;
        };
        Relationships: [];
      };
      wd_credits: {
        Row: {
          created_at: string | null;
          credits: number | null;
          id: number;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          credits?: number | null;
          id?: never;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          credits?: number | null;
          id?: never;
          user_id?: string | null;
        };
        Relationships: [];
      };
      webdraw_anon_gen: {
        Row: {
          created_at: string;
          id: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      webdraw_api_keys: {
        Row: {
          api_key: string;
          created_at: string;
          description: string | null;
          user_id: string;
        };
        Insert: {
          api_key: string;
          created_at?: string;
          description?: string | null;
          user_id: string;
        };
        Update: {
          api_key?: string;
          created_at?: string;
          description?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webdraw_fs_api_keys_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      webdraw_app_categories: {
        Row: {
          app_id: number;
          category_id: number;
          created_at: string;
          id: number;
        };
        Insert: {
          app_id: number;
          category_id: number;
          created_at?: string;
          id?: number;
        };
        Update: {
          app_id?: number;
          category_id?: number;
          created_at?: string;
          id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "webdraw_app_categories_app_id_fkey";
            columns: ["app_id"];
            isOneToOne: false;
            referencedRelation: "webdraw_community_apps";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "webdraw_app_categories_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "webdraw_community_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      webdraw_app_comments: {
        Row: {
          app_id: number;
          content: string;
          created_at: string;
          id: number;
          is_deleted: boolean | null;
          parent_id: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          app_id: number;
          content: string;
          created_at?: string;
          id?: number;
          is_deleted?: boolean | null;
          parent_id?: number | null;
          updated_at: string;
          user_id: string;
        };
        Update: {
          app_id?: number;
          content?: string;
          created_at?: string;
          id?: number;
          is_deleted?: boolean | null;
          parent_id?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webdraw_app_comments_app_id_fkey";
            columns: ["app_id"];
            isOneToOne: false;
            referencedRelation: "webdraw_community_apps";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "webdraw_app_comments_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "webdraw_app_comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "webdraw_app_comments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "webdraw_app_comments_user_id_fkey1";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "webdraw_user_metadata";
            referencedColumns: ["user_id"];
          },
        ];
      };
      webdraw_app_reactions: {
        Row: {
          app_id: number;
          comment_id: number | null;
          created_at: string;
          id: number;
          reaction: string;
          user_id: string;
        };
        Insert: {
          app_id: number;
          comment_id?: number | null;
          created_at?: string;
          id?: number;
          reaction: string;
          user_id: string;
        };
        Update: {
          app_id?: number;
          comment_id?: number | null;
          created_at?: string;
          id?: number;
          reaction?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webdraw_app_reactions_app_id_fkey";
            columns: ["app_id"];
            isOneToOne: false;
            referencedRelation: "webdraw_community_apps";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "webdraw_app_reactions_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "webdraw_app_comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "webdraw_app_reactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      webdraw_badge: {
        Row: {
          description: string;
          id: number;
          image: string;
          title: string;
        };
        Insert: {
          description: string;
          id?: number;
          image: string;
          title: string;
        };
        Update: {
          description?: string;
          id?: number;
          image?: string;
          title?: string;
        };
        Relationships: [];
      };
      webdraw_balance: {
        Row: {
          created_at: string;
          earnings_balance: string;
          id: number;
          use_balance: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          earnings_balance: string;
          id?: number;
          use_balance: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          earnings_balance?: string;
          id?: number;
          use_balance?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webdraw_balance_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      webdraw_community_apps: {
        Row: {
          allow_fork: boolean | null;
          content: string;
          created_at: string;
          icon_url: string | null;
          id: number;
          link: string;
          medias: Json[] | null;
          milestones: Json | null;
          short_description: string | null;
          slug: string | null;
          title: string;
          uid: string | null;
          updated_at: string;
          user_id: string;
          views: number;
          visibility: string;
        };
        Insert: {
          allow_fork?: boolean | null;
          content: string;
          created_at?: string;
          icon_url?: string | null;
          id?: number;
          link: string;
          medias?: Json[] | null;
          milestones?: Json | null;
          short_description?: string | null;
          slug?: string | null;
          title: string;
          uid?: string | null;
          updated_at: string;
          user_id: string;
          views: number;
          visibility?: string;
        };
        Update: {
          allow_fork?: boolean | null;
          content?: string;
          created_at?: string;
          icon_url?: string | null;
          id?: number;
          link?: string;
          medias?: Json[] | null;
          milestones?: Json | null;
          short_description?: string | null;
          slug?: string | null;
          title?: string;
          uid?: string | null;
          updated_at?: string;
          user_id?: string;
          views?: number;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webdraw_apps_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "webdraw_community_apps_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "webdraw_user_metadata";
            referencedColumns: ["user_id"];
          },
        ];
      };
      webdraw_community_categories: {
        Row: {
          created_at: string;
          id: number;
          name: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          name: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          name?: string;
        };
        Relationships: [];
      };
      webdraw_credit_use: {
        Row: {
          cache_creation_input_tokens: number | null;
          cache_read_input_tokens: number | null;
          created_at: string;
          id: number;
          input_tokens: number | null;
          model: string | null;
          output_tokens: number | null;
          quantity: number;
          user_id: string;
        };
        Insert: {
          cache_creation_input_tokens?: number | null;
          cache_read_input_tokens?: number | null;
          created_at?: string;
          id?: number;
          input_tokens?: number | null;
          model?: string | null;
          output_tokens?: number | null;
          quantity: number;
          user_id: string;
        };
        Update: {
          cache_creation_input_tokens?: number | null;
          cache_read_input_tokens?: number | null;
          created_at?: string;
          id?: number;
          input_tokens?: number | null;
          model?: string | null;
          output_tokens?: number | null;
          quantity?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webdraw_credit_use_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      webdraw_daily_credit_claim: {
        Row: {
          claimed_at: string;
          id: number;
          user_id: string;
        };
        Insert: {
          claimed_at?: string;
          id?: number;
          user_id: string;
        };
        Update: {
          claimed_at?: string;
          id?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webdraw_daily_credit_claim_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      webdraw_email_queue: {
        Row: {
          attempts: number;
          created_at: string;
          error: string | null;
          from_email: string;
          html: string;
          id: number;
          status: string;
          subject: string;
          to_email: string;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          error?: string | null;
          from_email: string;
          html: string;
          id?: number;
          status?: string;
          subject: string;
          to_email: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          error?: string | null;
          from_email?: string;
          html?: string;
          id?: number;
          status?: string;
          subject?: string;
          to_email?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      webdraw_followers: {
        Row: {
          created_at: string;
          followed_by: string;
          id: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          followed_by: string;
          id?: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          followed_by?: string;
          id?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webdraw_followers_followed_by_fkey";
            columns: ["followed_by"];
            isOneToOne: false;
            referencedRelation: "webdraw_user_metadata";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "webdraw_followers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "webdraw_user_metadata";
            referencedColumns: ["user_id"];
          },
        ];
      };
      webdraw_google_tokens: {
        Row: {
          access_token: string | null;
          created_at: string;
          expiry_date: string;
          id: number;
          refresh_token: string;
          token_type: string;
        };
        Insert: {
          access_token?: string | null;
          created_at?: string;
          expiry_date: string;
          id?: number;
          refresh_token: string;
          token_type: string;
        };
        Update: {
          access_token?: string | null;
          created_at?: string;
          expiry_date?: string;
          id?: number;
          refresh_token?: string;
          token_type?: string;
        };
        Relationships: [];
      };
      webdraw_has_access: {
        Row: {
          created_at: string;
          id: number;
          user_id: string;
          waitlist_data: Json | null;
        };
        Insert: {
          created_at?: string;
          id?: number;
          user_id: string;
          waitlist_data?: Json | null;
        };
        Update: {
          created_at?: string;
          id?: number;
          user_id?: string;
          waitlist_data?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "webdraw_has_access_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      webdraw_integrations: {
        Row: {
          config: Json | null;
          created_at: string;
          id: number;
          integration_id: string;
          status: string;
          user_id: string;
        };
        Insert: {
          config?: Json | null;
          created_at?: string;
          id?: number;
          integration_id: string;
          status: string;
          user_id: string;
        };
        Update: {
          config?: Json | null;
          created_at?: string;
          id?: number;
          integration_id?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webdraw_integrations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      webdraw_onboarding: {
        Row: {
          claimed_20k_prize: boolean | null;
          completed_steps: string[];
          created_at: string;
          current_step: string;
          id: number;
          user_id: string;
        };
        Insert: {
          claimed_20k_prize?: boolean | null;
          completed_steps?: string[];
          created_at?: string;
          current_step?: string;
          id?: number;
          user_id: string;
        };
        Update: {
          claimed_20k_prize?: boolean | null;
          completed_steps?: string[];
          created_at?: string;
          current_step?: string;
          id?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      webdraw_pending_notifications: {
        Row: {
          expires_at: string | null;
          id: string;
          last_message_ts: number | null;
          nickname: string | null;
          session_id: string;
        };
        Insert: {
          expires_at?: string | null;
          id: string;
          last_message_ts?: number | null;
          nickname?: string | null;
          session_id: string;
        };
        Update: {
          expires_at?: string | null;
          id?: string;
          last_message_ts?: number | null;
          nickname?: string | null;
          session_id?: string;
        };
        Relationships: [];
      };
      webdraw_session_share_code: {
        Row: {
          code: string;
          created_at: string;
          expires_at: string;
          id: number;
          principal_id: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          expires_at: string;
          id?: number;
          principal_id: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          expires_at?: string;
          id?: number;
          principal_id?: string;
        };
        Relationships: [];
      };
      webdraw_streak: {
        Row: {
          created_at: string;
          credits: number;
          current_streak: number | null;
          id: number;
          last_streak_date: string | null;
          longest_streak: number | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          credits?: number;
          current_streak?: number | null;
          id?: number;
          last_streak_date?: string | null;
          longest_streak?: number | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          credits?: number;
          current_streak?: number | null;
          id?: number;
          last_streak_date?: string | null;
          longest_streak?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webdraw_credits_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      webdraw_streak_marker: {
        Row: {
          created_at: string;
          id: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webdraw_streak_marker_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      webdraw_subscriptions: {
        Row: {
          created_at: string | null;
          customer_details: Json | null;
          id: string;
          status: string;
          subscription_id: string | null;
          tax_id: string | null;
          type: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          customer_details?: Json | null;
          id: string;
          status?: string;
          subscription_id?: string | null;
          tax_id?: string | null;
          type?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          customer_details?: Json | null;
          id?: string;
          status?: string;
          subscription_id?: string | null;
          tax_id?: string | null;
          type?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "webdraw_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      webdraw_transaction: {
        Row: {
          amount: string;
          created_at: string;
          id: number;
          meta: Json | null;
          type: string;
          user_id: string;
        };
        Insert: {
          amount: string;
          created_at?: string;
          id?: number;
          meta?: Json | null;
          type: string;
          user_id: string;
        };
        Update: {
          amount?: string;
          created_at?: string;
          id?: number;
          meta?: Json | null;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webdraw_transaction_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      webdraw_user_badge: {
        Row: {
          badge_id: number;
          created_at: string;
          id: number;
          user_id: string;
        };
        Insert: {
          badge_id: number;
          created_at?: string;
          id?: number;
          user_id: string;
        };
        Update: {
          badge_id?: number;
          created_at?: string;
          id?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webdraw_user_badge_badge_id_fkey";
            columns: ["badge_id"];
            isOneToOne: false;
            referencedRelation: "webdraw_badge";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "webdraw_user_badge_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "webdraw_user_badge_user_id_fkey1";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "webdraw_user_metadata";
            referencedColumns: ["user_id"];
          },
        ];
      };
      webdraw_user_metadata: {
        Row: {
          avatar_url: string | null;
          company: string | null;
          created_at: string;
          drawinrio_prize_claimed: boolean | null;
          first_domain_claim_at: string | null;
          full_name: string | null;
          github_url: string | null;
          id: number;
          linkedin_url: string | null;
          occupation: string | null;
          show_email_public: boolean | null;
          survey_data: Json | null;
          user_id: string;
          username: string;
          website_url: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          company?: string | null;
          created_at?: string;
          drawinrio_prize_claimed?: boolean | null;
          first_domain_claim_at?: string | null;
          full_name?: string | null;
          github_url?: string | null;
          id?: number;
          linkedin_url?: string | null;
          occupation?: string | null;
          show_email_public?: boolean | null;
          survey_data?: Json | null;
          user_id: string;
          username: string;
          website_url?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          company?: string | null;
          created_at?: string;
          drawinrio_prize_claimed?: boolean | null;
          first_domain_claim_at?: string | null;
          full_name?: string | null;
          github_url?: string | null;
          id?: number;
          linkedin_url?: string | null;
          occupation?: string | null;
          show_email_public?: boolean | null;
          survey_data?: Json | null;
          user_id?: string;
          username?: string;
          website_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "webdraw_user_metadata_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      webdraw_user_notifications: {
        Row: {
          created_at: string;
          data: Json | null;
          id: number;
          image: string | null;
          link: string | null;
          message: string;
          read_at: string | null;
          status: string;
          title: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          data?: Json | null;
          id?: number;
          image?: string | null;
          link?: string | null;
          message: string;
          read_at?: string | null;
          status: string;
          title?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          data?: Json | null;
          id?: number;
          image?: string | null;
          link?: string | null;
          message?: string;
          read_at?: string | null;
          status?: string;
          title?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webdraw_user_notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "webdraw_user_notifications_user_id_fkey1";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "webdraw_user_metadata";
            referencedColumns: ["user_id"];
          },
        ];
      };
      webdraw_user_preferences: {
        Row: {
          auto_save_enabled: boolean;
          created_at: string;
          id: number;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          auto_save_enabled?: boolean;
          created_at?: string;
          id?: number;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          auto_save_enabled?: boolean;
          created_at?: string;
          id?: number;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      webdraw_withdraw_request: {
        Row: {
          amount: string;
          created_at: string;
          id: string;
          status: string;
          user_id: string;
        };
        Insert: {
          amount: string;
          created_at?: string;
          id?: string;
          status: string;
          user_id: string;
        };
        Update: {
          amount?: string;
          created_at?: string;
          id?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webdraw_withdraw_request_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      workflow_executions: {
        Row: {
          created_at: string;
          id: number;
          site: string | null;
          workflow_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: number;
          site?: string | null;
          workflow_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: number;
          site?: string | null;
          workflow_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      users_meta_data_view: {
        Row: {
          id: string | null;
          raw_app_meta_data: Json | null;
          raw_user_meta_data: Json | null;
        };
        Insert: {
          id?: string | null;
          raw_app_meta_data?: Json | null;
          raw_user_meta_data?: Json | null;
        };
        Update: {
          id?: string | null;
          raw_app_meta_data?: Json | null;
          raw_user_meta_data?: Json | null;
        };
        Relationships: [];
      };
      webdraw_credits: {
        Row: {
          created_at: string | null;
          credits: number | null;
          current_streak: number | null;
          id: number | null;
          last_streak_date: string | null;
          longest_streak: number | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          credits?: number | null;
          current_streak?: number | null;
          id?: number | null;
          last_streak_date?: string | null;
          longest_streak?: number | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          credits?: number | null;
          current_streak?: number | null;
          id?: number | null;
          last_streak_date?: string | null;
          longest_streak?: number | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "webdraw_credits_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
    };
    Functions: {
      create_team_and_member: {
        Args: { name: string };
        Returns: number;
      };
      deduct_app_use_balance: {
        Args: { amount: string; target_user_id: string };
        Returns: undefined;
      };
      deduct_earnings_balance: {
        Args: { amount: string; target_user_id: string };
        Returns: undefined;
      };
      exchange_session_share_code: {
        Args: { code: string };
        Returns: Json;
      };
      generate_referral_code: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      get_app_reactions: {
        Args: {
          app_id: number;
          comment_id?: number;
          from_offset: number;
          to_offset: number;
        };
        Returns: {
          avatar_url: string;
          company: string;
          full_name: string;
          id: string;
          occupation: string;
          reaction: string;
          username: string;
        }[];
      };
      get_apps_by_category: {
        Args: {
          category_id: number;
          from_date?: string;
          from_offset: number;
          to_offset: number;
        };
        Returns: {
          allow_fork: boolean;
          avatar_url: string;
          content: string;
          created_at: string;
          full_name: string;
          icon_url: string;
          id: number;
          link: string;
          medias: Json[];
          reactions: number;
          short_description: string;
          slug: string;
          title: string;
          updated_at: string;
          user_apps: Json;
          user_id: string;
          user_metadata_user_id: string;
          username: string;
          visibility: string;
          webdraw_app_reactions: Json;
        }[];
      };
      get_followers_by_profile_id: {
        Args: {
          limit_value: number;
          logged_user_id: string;
          page: number;
          profile_id: string;
        };
        Returns: {
          avatar_url: string;
          company: string;
          created_at: string;
          full_name: string;
          id: number;
          is_following: boolean;
          occupation: string;
          user_id: string;
          username: string;
        }[];
      };
      get_followers_by_user_id: {
        Args: {
          limit_value: number;
          logged_user_id: string;
          page: number;
          profile_id: string;
        };
        Returns: {
          avatar_url: string;
          company: string;
          created_at: string;
          full_name: string;
          id: number;
          is_following: boolean;
          occupation: string;
          user_id: string;
          username: string;
        }[];
      };
      get_following_by_user_id: {
        Args:
          | {
              limit_rows?: number;
              logged_user_id: string;
              page: number;
              profile_id: string;
            }
          | {
              limit_rows?: number;
              logged_user_id: string;
              page: number;
              profile_id: string;
            };
        Returns: {
          avatar_url: string;
          company: string;
          created_at: string;
          full_name: string;
          id: number;
          is_following: boolean;
          occupation: string;
          user_id: string;
          username: string;
        }[];
      };
      get_followings_by_profile_id: {
        Args: {
          limit_value: number;
          logged_user_id: string;
          page: number;
          profile_id: string;
        };
        Returns: {
          avatar_url: string;
          company: string;
          created_at: string;
          full_name: string;
          id: number;
          is_following: boolean;
          occupation: string;
          user_id: string;
          username: string;
        }[];
      };
      get_latest_user_activity: {
        Args: {
          p_key?: string;
          p_resource?: string;
          p_user_id?: string;
          p_value?: string;
        };
        Returns: {
          created_at: string;
          key: string;
          resource: string;
          user_id: string;
          value: string;
        }[];
      };
      get_more_liked_apps: {
        Args: { from_offset: number; to_offset: number };
        Returns: {
          avatar_url: string;
          content: string;
          created_at: string;
          full_name: string;
          id: number;
          likes: number;
          link: string;
          medias: Json[];
          slug: string;
          title: string;
          updated_at: string;
          user_id: string;
          user_metadata_user_id: string;
          username: string;
          visibility: string;
          webdraw_app_likes: Json;
        }[];
      };
      get_more_reacted_apps: {
        Args: { from_date?: string; from_offset: number; to_offset: number };
        Returns: {
          avatar_url: string;
          content: string;
          created_at: string;
          full_name: string;
          icon_url: string;
          id: number;
          link: string;
          medias: Json[];
          reactions: number;
          short_description: string;
          slug: string;
          title: string;
          updated_at: string;
          user_apps: Json;
          user_id: string;
          user_metadata_user_id: string;
          username: string;
          visibility: string;
          webdraw_app_reactions: Json;
        }[];
      };
      get_reacted_apps_by_user_id: {
        Args: { from_offset: number; to_offset: number; user_id_input: string };
        Returns: {
          avatar_url: string;
          content: string;
          created_at: string;
          full_name: string;
          icon_url: string;
          id: number;
          link: string;
          medias: Json[];
          reactions: number;
          short_description: string;
          slug: string;
          title: string;
          updated_at: string;
          user_apps: Json;
          user_id: string;
          user_metadata_user_id: string;
          username: string;
          visibility: string;
          webdraw_app_reactions: Json;
        }[];
      };
      get_student_by_email: {
        Args: { user_email: string };
        Returns: {
          referral_id: string | null;
          referrals_count: number;
          referred_by: string | null;
          student_id: number;
          university_id: number;
        };
      };
      get_university: {
        Args: { domain_text: string };
        Returns: {
          acronym: string | null;
          created_at: string;
          domains: string[] | null;
          id: number;
          name: string | null;
          quantity: number | null;
          quantity_updated_at: string | null;
        }[];
      };
      get_university_by_email: {
        Args: { user_email: string };
        Returns: {
          acronym: string | null;
          created_at: string;
          domains: string[] | null;
          id: number;
          name: string | null;
          quantity: number | null;
          quantity_updated_at: string | null;
        };
      };
      is_member_of: {
        Args: { _team_id: number; _user_id: string };
        Returns: boolean;
      };
      list_distinct_blocks: {
        Args: { resolve_type: string; site: string };
        Returns: {
          __resolveType: string;
          block_count: number;
          created_at: string;
          created_by: string;
          id: string;
          revision: string;
          site: string;
          value: Json;
        }[];
      };
      list_many_distinct_blocks: {
        Args: { resolve_type: string[]; site: string };
        Returns: {
          __resolveType: string;
          block_count: number;
          created_at: string;
          created_by: string;
          id: string;
          revision: string;
          site: string;
          value: Json;
        }[];
      };
      list_many_distinct_blocks_optimized: {
        Args: { resolve_type: string[]; site: string };
        Returns: {
          __resolveType: string;
          block_count: number;
          created_at: string;
          created_by: string;
          id: string;
          revision: string;
          site: string;
          value: Json;
        }[];
      };
      put_app_use_balance: {
        Args: { amount: string; target_user_id: string };
        Returns: undefined;
      };
      put_earnings_balance: {
        Args: { amount: string; target_user_id: string };
        Returns: undefined;
      };
      rank_search_community_apps: {
        Args: { search_text: string };
        Returns: {
          allow_fork: boolean;
          content: string;
          created_at: string;
          icon_url: string;
          id: number;
          link: string;
          medias: Json[];
          metadata_score: number;
          milestones: Json;
          short_description: string;
          slug: string;
          title: string;
          uid: string;
          updated_at: string;
          user_id: string;
          views: number;
          visibility: string;
        }[];
      };
      register_app_usage: {
        Args: {
          deduct_amount: string;
          earning_amount: string;
          user_id_from: string;
          user_id_to: string;
        };
        Returns: undefined;
      };
      rpc_safe_execute: {
        Args: { query_text: string };
        Returns: Json[];
      };
      search_community_apps: {
        Args: { search_text: string };
        Returns: {
          allow_fork: boolean;
          content: string;
          created_at: string;
          icon_url: string;
          id: number;
          link: string;
          medias: Json[];
          metadata_score: number;
          milestones: Json;
          reactions: Json;
          short_description: string;
          slug: string;
          title: string;
          uid: string;
          updated_at: string;
          user_id: string;
          user_metadata: Json;
          views: number;
          visibility: string;
        }[];
      };
      update_referral_by_email: {
        Args: { new_referred_by: string; user_email: string };
        Returns: {
          referral_id: string | null;
          referrals_count: number;
          referred_by: string | null;
          student_id: number;
          university_id: number;
        };
      };
      update_university: {
        Args: { domain_text: string };
        Returns: {
          acronym: string | null;
          created_at: string;
          domains: string[] | null;
          id: number;
          name: string | null;
          quantity: number | null;
          quantity_updated_at: string | null;
        }[];
      };
      user_has_webdraw_access: {
        Args: { useremail: string };
        Returns: boolean;
      };
      webdraw_exchange_auth_code: {
        Args: { code: string };
        Returns: Json;
      };
    };
    Enums: {
      deco_chat_visibility_type: "public" | "private" | "role_based";
      visibility_type: "PUBLIC" | "WORKSPACE" | "PRIVATE";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      deco_chat_visibility_type: ["public", "private", "role_based"],
      visibility_type: ["PUBLIC", "WORKSPACE", "PRIVATE"],
    },
  },
} as const;
