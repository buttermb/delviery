import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
    AlertCircle,
    CheckCircle2,
    Info,
    AlertTriangle,
    Type,
    Palette,
    Box,
    Layers,
    Component
} from 'lucide-react';

export default function DesignSystemPage() {
    return (
        <div className="container mx-auto py-10 space-y-8 max-w-7xl">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Design System</h1>
                <p className="text-muted-foreground">
                    FloraIQ Foundation: Design Tokens, Components, and Utilities.
                </p>
            </div>

            <Tabs defaultValue="colors" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="colors" className="flex items-center gap-2"><Palette className="w-4 h-4" /> Colors</TabsTrigger>
                    <TabsTrigger value="typography" className="flex items-center gap-2"><Type className="w-4 h-4" /> Typography</TabsTrigger>
                    <TabsTrigger value="components" className="flex items-center gap-2"><Component className="w-4 h-4" /> Components</TabsTrigger>
                    <TabsTrigger value="layout" className="flex items-center gap-2"><Box className="w-4 h-4" /> Spacing & Layout</TabsTrigger>
                    <TabsTrigger value="effects" className="flex items-center gap-2"><Layers className="w-4 h-4" /> Effects</TabsTrigger>
                </TabsList>

                {/* --- COLORS --- */}
                <TabsContent value="colors" className="space-y-6">
                    <SectionTitle title="Semantic Colors" description="Core semantic colors used throughout the application." />

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <ColorCard name="Primary" variable="bg-primary" text="text-primary-foreground" />
                        <ColorCard name="Secondary" variable="bg-secondary" text="text-secondary-foreground" />
                        <ColorCard name="Accent" variable="bg-accent" text="text-accent-foreground" />
                        <ColorCard name="Muted" variable="bg-muted" text="text-muted-foreground" />
                        <ColorCard name="Destructive" variable="bg-destructive" text="text-destructive-foreground" />
                        <ColorCard name="Warning" variable="bg-warning" text="text-warning-foreground" />
                        <ColorCard name="Success" variable="bg-success" text="text-success-foreground" />
                        <ColorCard name="Info" variable="bg-info" text="text-info-foreground" />
                    </div>

                    <SectionTitle title="Base Colors" description="Background and foreground base colors." />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="p-4 border rounded-lg bg-background text-foreground space-y-2">
                            <div className="font-semibold">Background</div>
                            <div className="text-xs opacity-70">bg-background</div>
                        </div>
                        <div className="p-4 border rounded-lg bg-card text-card-foreground space-y-2">
                            <div className="font-semibold">Card</div>
                            <div className="text-xs opacity-70">bg-card</div>
                        </div>
                        <div className="p-4 border rounded-lg bg-popover text-popover-foreground space-y-2">
                            <div className="font-semibold">Popover</div>
                            <div className="text-xs opacity-70">bg-popover</div>
                        </div>
                    </div>
                </TabsContent>

                {/* --- TYPOGRAPHY --- */}
                <TabsContent value="typography" className="space-y-8">
                    <SectionTitle title="Headings" description="Inter font family, tracking tight." />
                    <div className="space-y-4 border p-6 rounded-lg">
                        <div className="space-y-1">
                            <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">Heading 1</h1>
                            <p className="text-xs text-muted-foreground">text-4xl font-extrabold tracking-tight lg:text-5xl</p>
                        </div>
                        <Separator />
                        <div className="space-y-1">
                            <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">Heading 2</h2>
                            <p className="text-xs text-muted-foreground">text-3xl font-semibold tracking-tight</p>
                        </div>
                        <Separator />
                        <div className="space-y-1">
                            <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">Heading 3</h3>
                            <p className="text-xs text-muted-foreground">text-2xl font-semibold tracking-tight</p>
                        </div>
                        <Separator />
                        <div className="space-y-1">
                            <h4 className="scroll-m-20 text-xl font-semibold tracking-tight">Heading 4</h4>
                            <p className="text-xs text-muted-foreground">text-xl font-semibold tracking-tight</p>
                        </div>
                    </div>

                    <SectionTitle title="Body & Text" description="Standard text styles." />
                    <div className="grid gap-6 border p-6 rounded-lg">
                        <div className="space-y-1">
                            <p className="leading-7 [&:not(:first-child)]:mt-6">
                                The king, seeing how much happier his subjects were, realized the error of his ways and repealed the joke tax.
                            </p>
                            <p className="text-xs text-muted-foreground">Paragraph (p)</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Blockquote / Muted Text</p>
                            <blockquote className="mt-6 border-l-2 pl-6 italic">
                                "After all," he said, "everyone enjoys a good joke, so it's only fair that they should pay for the privilege."
                            </blockquote>
                        </div>
                        <div className="space-y-1">
                            <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold">
                                @radix-ui/react-alert-dialog
                            </code>
                            <p className="text-xs text-muted-foreground mt-2">Inline Code</p>
                        </div>
                    </div>
                </TabsContent>

                {/* --- COMPONENTS --- */}
                <TabsContent value="components" className="space-y-8">

                    {/* Buttons */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">Buttons</h3>
                        <div className="flex flex-wrap gap-4 p-6 border rounded-lg bg-card">
                            <Button>Primary</Button>
                            <Button variant="secondary">Secondary</Button>
                            <Button variant="outline">Outline</Button>
                            <Button variant="ghost">Ghost</Button>
                            <Button variant="destructive">Destructive</Button>
                            <Button variant="link">Link</Button>
                            <Button disabled>Disabled</Button>
                        </div>
                    </div>

                    {/* Badges */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">Badges</h3>
                        <div className="flex flex-wrap gap-4 p-6 border rounded-lg bg-card">
                            <Badge>Default</Badge>
                            <Badge variant="secondary">Secondary</Badge>
                            <Badge variant="outline">Outline</Badge>
                            <Badge variant="destructive">Destructive</Badge>
                            <Badge className="bg-warning text-warning-foreground hover:bg-warning/90">Warning</Badge>
                            <Badge className="bg-success text-success-foreground hover:bg-success/90">Success</Badge>
                            <Badge className="bg-info text-info-foreground hover:bg-info/90">Info</Badge>
                        </div>
                    </div>

                    {/* Inputs */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">Inputs & Controls</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 border rounded-lg bg-card">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email address</Label>
                                    <Input id="email" placeholder="name@example.com" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">Password</Label>
                                    <Input id="password" type="password" />
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="terms" />
                                    <Label htmlFor="terms">Accept terms and conditions</Label>
                                </div>
                                <div className="flex items-center space-x-2 pt-2">
                                    <Switch id="airplane-mode" />
                                    <Label htmlFor="airplane-mode">Airplane Mode</Label>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Example Card</CardTitle>
                                        <CardDescription>This is a standard card component.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground">Card content goes here.</p>
                                    </CardContent>
                                    <CardFooter>
                                        <Button className="w-full">Action</Button>
                                    </CardFooter>
                                </Card>
                            </div>
                        </div>
                    </div>

                    {/* Feedback */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">Feedback States</h3>
                        <div className="grid gap-4 p-6 border rounded-lg bg-card">
                            <div className="p-4 rounded-md bg-destructive/10 text-destructive flex gap-3 items-center">
                                <AlertCircle className="w-5 h-5" />
                                <div>
                                    <h4 className="font-semibold">Error Message</h4>
                                    <p className="text-sm opacity-90">Something went wrong with your request.</p>
                                </div>
                            </div>
                            <div className="p-4 rounded-md bg-warning/10 text-warning-foreground flex gap-3 items-center">
                                <AlertTriangle className="w-5 h-5 text-warning" />
                                <div className="text-warning-foreground">
                                    <h4 className="font-semibold text-warning">Warning Message</h4>
                                    <p className="text-sm opacity-90 text-warning">Your session is about to expire.</p>
                                </div>
                            </div>
                            <div className="p-4 rounded-md bg-success/10 text-emerald-800 flex gap-3 items-center">
                                <CheckCircle2 className="w-5 h-5 text-success" />
                                <div>
                                    <h4 className="font-semibold text-success">Success Message</h4>
                                    <p className="text-sm opacity-90 text-success">Operation completed successfully.</p>
                                </div>
                            </div>
                            <div className="p-4 rounded-md bg-info/10 text-blue-800 flex gap-3 items-center">
                                <Info className="w-5 h-5 text-info" />
                                <div>
                                    <h4 className="font-semibold text-info">Info Message</h4>
                                    <p className="text-sm opacity-90 text-info">New features are available.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* --- LAYOUT --- */}
                <TabsContent value="layout" className="space-y-8">
                    <SectionTitle title="Spacing Scale" description="Based on 4px grid (0.25rem)." />
                    <div className="space-y-2 p-6 border rounded-lg">
                        {[1, 2, 3, 4, 6, 8, 12, 16, 24, 32].map((space) => (
                            <div key={space} className="flex items-center gap-4">
                                <div className="w-16 text-sm text-muted-foreground font-mono">space-{space}</div>
                                <div
                                    className="bg-primary/20 border border-primary/50 h-6"
                                    style={{ width: `${space * 0.25}rem` }}
                                ></div>
                                <div className="text-xs text-muted-foreground">{space * 4}px / {space * 0.25}rem</div>
                            </div>
                        ))}
                    </div>

                    <SectionTitle title="Border Radius" description="Component corner roundness." />
                    <div className="flex flex-wrap gap-8 p-6 border rounded-lg">
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-20 h-20 bg-primary/20 border-2 border-primary rounded-none"></div>
                            <span className="text-xs font-mono">rounded-none</span>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-20 h-20 bg-primary/20 border-2 border-primary rounded-sm"></div>
                            <span className="text-xs font-mono">rounded-sm</span>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-20 h-20 bg-primary/20 border-2 border-primary rounded-md"></div>
                            <span className="text-xs font-mono">rounded-md</span>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-20 h-20 bg-primary/20 border-2 border-primary rounded-lg"></div>
                            <span className="text-xs font-mono">rounded-lg</span>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-20 h-20 bg-primary/20 border-2 border-primary rounded-xl"></div>
                            <span className="text-xs font-mono">rounded-xl</span>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-20 h-20 bg-primary/20 border-2 border-primary rounded-full"></div>
                            <span className="text-xs font-mono">rounded-full</span>
                        </div>
                    </div>
                </TabsContent>

                {/* --- EFFECTS --- */}
                <TabsContent value="effects" className="space-y-8">
                    <SectionTitle title="Shadows" description="Depth hierarchy." />
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 p-8 border rounded-lg bg-slate-50 dark:bg-slate-900/50">
                        <div className="h-24 bg-background rounded-lg shadow-sm flex items-center justify-center text-xs">shadow-sm</div>
                        <div className="h-24 bg-background rounded-lg shadow flex items-center justify-center text-xs">shadow</div>
                        <div className="h-24 bg-background rounded-lg shadow-md flex items-center justify-center text-xs">shadow-md</div>
                        <div className="h-24 bg-background rounded-lg shadow-lg flex items-center justify-center text-xs">shadow-lg</div>
                        <div className="h-24 bg-background rounded-lg shadow-xl flex items-center justify-center text-xs">shadow-xl</div>
                        <div className="h-24 bg-background rounded-lg shadow-2xl flex items-center justify-center text-xs">shadow-2xl</div>
                    </div>
                </TabsContent>

            </Tabs>
        </div>
    );
}

function SectionTitle({ title, description }: { title: string, description: string }) {
    return (
        <div className="space-y-1 pb-2 border-b">
            <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
        </div>
    );
}

function ColorCard({ name, variable, text = "text-foreground" }: { name: string, variable: string, text?: string }) {
    return (
        <div className="p-4 border rounded-lg space-y-3">
            <div className={`h-24 rounded-md w-full ${variable} shadow-sm border`}></div>
            <div>
                <div className={`font-semibold ${text.includes('primary') ? 'text-primary' : ''}`}>{name}</div>
                <div className="text-xs opacity-70 font-mono">{variable}</div>
            </div>
        </div>
    );
}
