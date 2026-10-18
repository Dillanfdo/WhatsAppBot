"use client"

import { createContext, useContext, type ComponentProps, type ReactNode } from "react"
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"
import { Label } from "@/components/ui/label"
import { cn } from "cn"

const Form = FormProvider

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName
}

const FormFieldContext = createContext<FormFieldContextValue | null>(null)

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

function useFormField() {
  const fieldContext = useContext(FormFieldContext)
  const form = useFormContext()

  if (!fieldContext) {
    throw new Error("useFormField must be used within FormField")
  }

  const fieldState = form.getFieldState(fieldContext.name, form.formState)

  return {
    name: fieldContext.name,
    formItemId: `${fieldContext.name}-form-item`,
    formDescriptionId: `${fieldContext.name}-form-item-description`,
    formMessageId: `${fieldContext.name}-form-item-message`,
    ...fieldState,
  }
}

const FormItem = ({ className, ...props }: ComponentProps<"div">) => {
  return <div className={cn("space-y-2", className)} {...props} />
}

const FormLabel = ({ className, ...props }: ComponentProps<typeof Label>) => {
  const { error, formItemId } = useFormField()
  return (
    <Label
      htmlFor={formItemId}
      className={cn(error && "text-destructive", className)}
      {...props}
    />
  )
}

const FormControl = ({ children }: { children: ReactNode }) => {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()
  return (
    <div
      id={formItemId}
      aria-describedby={
        error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId
      }
      className="mb-0"
      aria-invalid={Boolean(error)}
    >
      {children}
    </div>
  )
}

const FormDescription = ({ className, ...props }: ComponentProps<"p">) => {
  const { formDescriptionId } = useFormField()
  return (
    <p
      id={formDescriptionId}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

const FormMessage = ({ className, ...props }: ComponentProps<"p">) => {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error.message ?? "") : props.children

  if (!body) {
    return null
  }

  return (
    <p
      id={formMessageId}
      className={cn("text-sm text-destructive", className)}
      {...props}
    >
      {body}
    </p>
  )
}

export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
}
