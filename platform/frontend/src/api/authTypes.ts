export type CurrentUser = {
  id: number;
  email: string;
  role: string;
  is_active: boolean;
};

export type LoginResult = {
  access_token: string;
  token_type: string;
  user: CurrentUser;
};
