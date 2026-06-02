export type CurrentUser = {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  is_active: boolean;
};

export type LoginResult = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: CurrentUser;
};
