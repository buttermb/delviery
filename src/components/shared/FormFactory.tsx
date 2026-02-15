import { useForm, UseFormReturn, FieldValues, DefaultValues, Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Props for the FormFactory component
 * @template T - The Zod schema type
 */
interface FormFactoryProps<T extends z.ZodType<any, any>> {
    /** The Zod schema for validation */
    schema: T;
    /** Default values for the form */
    defaultValues: DefaultValues<z.infer<T>>;
    /** Callback function to handle form submission */
    onSubmit: (data: z.infer<T>) => Promise<void> | void;
    /** Array of field configurations to render */
    fields: FormFieldConfig<z.infer<T>>[];
    /** React Node for the submit button content (e.g. "Save Changes") */
    submitText?: ReactNode;
    /** Subtitle or description below the button (optional) */
    footer?: ReactNode;
    /** Custom class name for the form container */
    className?: string;
    /** Custom functionality to render additional content inside the form */
    children?: (form: UseFormReturn<z.infer<T>>) => ReactNode;
    /** If true, the submit button is hidden (useful if using children with custom submit) */
    hideSubmitButton?: boolean;
}

/**
 * Configuration for a single form field
 */
export interface FormFieldConfig<TFieldValues extends FieldValues> {
    /** The key name of the field in the schema */
    name: Path<TFieldValues>;
    /** Label to display above the input */
    label: string;
    /** Input type (text, email, password, etc) or 'select' / 'custom' */
    type: "text" | "email" | "password" | "number" | "select" | "textarea" | "custom";
    /** Placeholder text */
    placeholder?: string;
    /** Helper text displayed below the input */
    description?: string;
    /** Options for select inputs */
    options?: { label: string; value: string }[];
    /** Custom render function if type is 'custom' */
    render?: (form: UseFormReturn<TFieldValues>) => ReactNode;
    /** Class name for the field container */
    className?: string;
    /** Whether the field is required (shows red asterisk) */
    required?: boolean;
}

export function FormFactory<T extends z.ZodType<any, any>>({
    schema,
    defaultValues,
    onSubmit,
    fields,
    submitText = "Submit",
    className,
    children,
    hideSubmitButton = false,
}: FormFactoryProps<T>) {
    const form = useForm<z.infer<T>>({
        resolver: zodResolver(schema),
        defaultValues,
    });

    const {
        handleSubmit,
        formState: { isSubmitting },
    } = form;

    return (
        <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className={cn("space-y-4", className)}>
                {fields.map((field) => (
                    <FormField
                        key={String(field.name)}
                        control={form.control}
                        name={field.name}
                        render={({ field: formField }) => (
                            <FormItem className={field.className}>
                                <FormLabel required={field.required}>{field.label}</FormLabel>
                                <FormControl>
                                    {field.type === "custom" && field.render ? (
                                        field.render(form)
                                    ) : field.type === "select" ? (
                                        // Implement basic Select if needed, or rely on custom render for complex selects
                                        // For now, simpler to use custom render for Selects to leverage shadcn Select
                                        <div className="text-red-500">Use custom type for Select</div>
                                    ) : field.type === "textarea" ? (
                                        // Assuming you have a Textarea component, otherwise fallback to input
                                        <Input {...formField} placeholder={field.placeholder} />
                                    ) : (
                                        <Input
                                            {...formField}
                                            type={field.type}
                                            placeholder={field.placeholder}
                                            disabled={isSubmitting}
                                        />
                                    )}
                                </FormControl>
                                {field.description && <FormDescription>{field.description}</FormDescription>}
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                ))}

                {children && children(form)}

                {!hideSubmitButton && (
                    <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {submitText}
                    </Button>
                )}
            </form>
        </Form>
    );
}
