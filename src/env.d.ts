/// <reference path="../.astro/types.d.ts" />

interface AppUser {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

declare namespace App {
  interface Locals {
    user: AppUser | null;
  }
}
