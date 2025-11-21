
export interface Customer {
    id: string;
    phone?: string;
    email?: string;
    telegram_id?: string;
    name?: string;
}

export interface Message {
    subject?: string;
    body: string;
    templateId?: string;
    data?: any;
}

export class OmniChannelMessenger {
    private static instance: OmniChannelMessenger;
    // Mock providers configuration
    private providers = {
        sms: { enabled: true, provider: 'twilio' },
        whatsapp: { enabled: true, provider: 'whatsapp_business' },
        email: { enabled: true, provider: 'sendgrid' },
        telegram: { enabled: true, provider: 'telegram_bot' }
    };

    private constructor() { }

    static getInstance(): OmniChannelMessenger {
        if (!OmniChannelMessenger.instance) {
            OmniChannelMessenger.instance = new OmniChannelMessenger();
        }
        return OmniChannelMessenger.instance;
    }

    async sendMenuInvite(
        customer: Customer,
        menuUrl: string,
        preferredChannels: string[] = ['sms', 'email']
    ): Promise<{ success: boolean; channel?: string; error?: any }> {
        const message: Message = {
            subject: 'Your Exclusive Menu Access',
            body: `Hello ${customer.name || 'Valued Customer'}, here is your secure link to our latest menu: ${menuUrl}. This link expires in 24 hours.`
        };

        for (const channel of preferredChannels) {
            try {
                if (this.canSend(channel, customer)) {
                    await this.send(channel, customer, message);
                    console.log(`Successfully sent invite via ${channel}`);
                    return { success: true, channel };
                }
            } catch (error) {
                console.warn(`Failed to send via ${channel}:`, error);
                // Continue to next channel
            }
        }

        return { success: false, error: 'All channels failed' };
    }

    private canSend(channel: string, customer: Customer): boolean {
        switch (channel) {
            case 'sms': return !!customer.phone && this.providers.sms.enabled;
            case 'whatsapp': return !!customer.phone && this.providers.whatsapp.enabled;
            case 'email': return !!customer.email && this.providers.email.enabled;
            case 'telegram': return !!customer.telegram_id && this.providers.telegram.enabled;
            default: return false;
        }
    }

    private async send(channel: string, customer: Customer, message: Message) {
        // Mock implementation of sending logic
        // In production, this would call the respective APIs

        console.log(`[Mock] Sending ${channel} to ${this.getRecipient(channel, customer)}: ${message.body}`);

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 100));

        // Simulate random failure for testing robustness
        if (Math.random() < 0.05) {
            throw new Error(`Random mock failure for ${channel}`);
        }
    }

    private getRecipient(channel: string, customer: Customer): string | undefined {
        switch (channel) {
            case 'sms':
            case 'whatsapp': return customer.phone;
            case 'email': return customer.email;
            case 'telegram': return customer.telegram_id;
        }
    }
}
