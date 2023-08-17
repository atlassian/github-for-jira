export type SecretScanningAlertResponseItem = {
    number: number,
    created_at: string,
    updated_at?: string,
    url: string,
    html_url: string,
    locations_url: string,
    state: "open" | "resolved",
    resolution?: string,
    resolved_at?: string,
    resolution_comment?: string,
    secret_type: string,
    secret_type_display_name: string
  }