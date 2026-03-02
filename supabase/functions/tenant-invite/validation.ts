import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Schema for send_invitation action
const sendInvitationSchema = z.object({
  action: z.literal('send_invitation'),
  tenantId: z.string().uuid(),
  email: z.string().email().max(255),
  role: z.enum(['admin', 'manager', 'staff', 'viewer']),
});

// Schema for accept_invitation action
const acceptInvitationSchema = z.object({
  action: z.literal('accept_invitation'),
  token: z.string().min(1).max(500),
});

// Schema for list_invitations action
const listInvitationsSchema = z.object({
  action: z.literal('list_invitations'),
  tenantId: z.string().uuid(),
});

// Schema for get_invitation_details action (public)
const getInvitationDetailsSchema = z.object({
  action: z.literal('get_invitation_details'),
  token: z.string().min(1).max(500),
});

// Schema for cancel_invitation action
const cancelInvitationSchema = z.object({
  action: z.literal('cancel_invitation'),
  tenantId: z.string().uuid(),
  invitationId: z.string().uuid(),
});

// Union schema for all actions
export const tenantInviteSchema = z.discriminatedUnion('action', [
  sendInvitationSchema,
  acceptInvitationSchema,
  listInvitationsSchema,
  getInvitationDetailsSchema,
  cancelInvitationSchema,
]);

export type TenantInviteInput = z.infer<typeof tenantInviteSchema>;

export function validateTenantInvite(data: unknown): TenantInviteInput {
  const result = tenantInviteSchema.safeParse(data);
  if (!result.success) {
    const zodError = result as { success: false; error: { errors: { path: (string | number)[]; message: string }[] } };
    const errors = zodError.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Validation failed: ${errors}`);
  }
  return result.data;
}
