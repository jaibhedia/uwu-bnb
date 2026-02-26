import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                default:
                    "bg-gradient-to-r from-primary to-secondary text-white shadow-lg hover:shadow-glow-md hover:scale-105",
                secondary:
                    "bg-white/10 text-white backdrop-blur-sm border border-white/20 hover:bg-white/20",
                outline:
                    "border-2 border-primary text-primary hover:bg-primary hover:text-white",
                ghost: "text-white hover:bg-white/10",
                terminal:
                    "bg-terminal-surface border border-terminal-border text-neon-cyan font-mono hover:border-neon-cyan hover:shadow-neon",
                success:
                    "bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-lg",
                danger:
                    "bg-gradient-to-r from-red-500 to-pink-500 text-white hover:shadow-lg",
            },
            size: {
                default: "h-11 px-6 py-2",
                sm: "h-9 px-4 text-xs",
                lg: "h-14 px-8 text-base",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
