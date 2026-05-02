


import { JSX } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronDown, CheckCircle2 } from "lucide-react";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type Option = { label: string; value: string | number };

export interface CustomInputFieldProps {
  field: string;
  label: string;
  require?: boolean;
  view?: boolean;
  type?: string;
  options?: string | Option[]; // string -> key in optionsData, or array of options
  input?: boolean;
  className?: string;
  disabled?: boolean;
  value?: any;
  onChange?: (value: any) => void;
  optionsData?: Record<string, Option[]>;
  error?: string | null;
  placeholder?: string;
  maxLength?: number;
  show?: boolean;
  [key: string]: any;
}

export function CustomInputField({
  field,
  label,
  require = false,
  view = true,
  type = "text",
  options = [],
  input = true,
  className,
  disabled = false,
  value,
  onChange = () => {},
  optionsData = {},
  error,
  placeholder,
  maxLength,
  show = true,
  ...props
}: CustomInputFieldProps): JSX.Element | null {
  // hide S.No exactly like original
  if (label === "S.No") {
    return null;
  }

  const getOptionsArray = (): Option[] => {
    if (typeof options === "string") {
      return optionsData[options] ?? [];
    }
    return Array.isArray(options) ? options : [];
  };

  const optionsArray = getOptionsArray();

  // eventOrValue can be a native event or a direct value (from Select / Switch / Checkbox)
  const handleChange = (eventOrValue: any) => {
    let actualValue: any;

    // React change event (Input or Textarea)
    if (
      eventOrValue &&
      typeof eventOrValue === "object" &&
      "target" in eventOrValue &&
      eventOrValue.target !== undefined
    ) {
      actualValue = eventOrValue.target.value;
    } else {
      // direct value from Select onValueChange, onCheckedChange etc.
      actualValue = eventOrValue;
    }

    try {
      onChange(actualValue);
    } catch {
      // swallow if onChange not provided or errors
      // (keeps parity with original untyped behavior)
    }
  };

  /**
   * Local reusable FileUploadField used only by the "file" input case.
   * - `fileValue` is expected to be a File | null
   * - calls `onFileChange(File | null)` when file is selected or cleared
   */
  const FileUploadField = ({
   label,
    name,
    fileValue,
    onFileChange,
  }: {
   label: string;
    name: string;
    fileValue: File | null | undefined;
    onFileChange: (f: File | null) => void;
  }) => {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files && e.target.files.length > 0 ? e.target.files[0] : null;
      onFileChange(file);
    };

    return (
      <div className="space-y-2">
       
        <div className="flex items-center gap-2">
          <Input
            id={name}
            type="file"
            name={name}
            accept="application/pdf,image/*"
            onChange={handleFileChange}
            className="flex-1"
          />
          {fileValue && (
            <Badge variant="secondary" className="whitespace-nowrap">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {fileValue.name.length > 15 ? `${fileValue.name.slice(0, 15)}...` : fileValue.name}
            </Badge>
          )}
        </div>
      </div>
    );
  };

  const renderInput = (): JSX.Element => {
    const inputType = type?.toLowerCase?.() ?? "text";

    switch (inputType) {
      case "textarea":
        return (
          <Textarea
            name={field}
            className={cn(className, error && "border-red-500")}
            disabled={disabled}
            rows={3}
            placeholder={placeholder}
            value={value ?? ""}
            onChange={handleChange}
            required={require}
            {...props}
          />
        );

      case "select":
        return (
          <Select
            name={field}
            value={value ? String(value) : ""}
            onValueChange={(v: string) => handleChange(v)}
            disabled={disabled}
            required={require}
          >
            <SelectTrigger className={cn(className, error && "border-red-500")}>
              <SelectValue placeholder={`Select ${label}`} />
            </SelectTrigger>
            <SelectContent>
              {optionsArray.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "checkbox":
        return (
          <Checkbox
            name={field}
            checked={Boolean(value)}
            onCheckedChange={(checked: boolean) => handleChange(checked)}
            disabled={disabled}
            className={cn(className)}
            {...props}
          />
        );
        case "checkboxs":
  return (
    <>
      {optionsArray.map((option: Option) => (
        <div key={option.value} className="flex items-center space-x-2">
          <Checkbox
            id={`${field}-${option.value}`}
            name={field}
            checked={Array.isArray(value) ? value.includes(option.value) : value === option.value}
            onCheckedChange={(checked: boolean) => {
              // Handle multiple checkbox selections
              if (Array.isArray(value)) {
                const newValue = checked
                  ? [...value, option.value]
                  : value.filter((v: string) => v !== option.value);
                handleChange(newValue);
              } else {
                handleChange(checked ? option.value : null);
              }
            }}
            disabled={disabled}
          />
          <Label 
            htmlFor={`${field}-${option.value}`} 
            className="text-sm font-normal cursor-pointer"
          >
            {option.label}
          </Label>
        </div>
      ))}
    </>
  );


      case "switch":
        return (
          <Switch
            name={field}
            checked={Boolean(value)}
            onCheckedChange={(checked: boolean) => handleChange(checked)}
            disabled={disabled}
            className={cn(className)}
            {...props}
          />
        );

      case "number":
        return (
          <Input
            name={field}
            type="number"
            placeholder={placeholder}
            className={cn(className, error && "border-red-500")}
            disabled={disabled}
            value={value ?? ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const newValue = e.target.value;
              // Limit number of digits if maxLength provided
              if (maxLength && newValue.length > maxLength) {
                // ignore input beyond maxLength
                return;
              }
              handleChange(e);
            }}
            required={require}
            {...props}
          />
        );

      case "email":
        return (
          <Input
            name={field}
            type="email"
            placeholder={placeholder}
            className={cn(className, error && "border-red-500")}
            disabled={disabled}
            value={value ?? ""}
            onChange={handleChange}
            required={require}
            {...props}
          />
        );
        case "radio":
          
  return (
    <RadioGroup
      name={field}
      value={value ?? 'true'}
      onValueChange={(v: string) => handleChange(v)}
      disabled={disabled}
      className={cn("flex flex-wrap gap-2", className, error && "border-red-500")}
    >
      {optionsArray.map((option) => (
        <div key={option.value} className="flex items-center space-x-2">
          <RadioGroupItem value={String(option.value)} id={`${field}-${option.value}`} />
          <Label
            htmlFor={`${field}-${option.value}`}
            className="text-sm font-normal cursor-pointer"
          >
            {option.label}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );



      case "date":
        return (
          <Input
            name={field}
            type="date"
            className={cn(className, error && "border-red-500")}
            disabled={disabled}
            value={value ?? ""}
            onChange={handleChange}
            required={require}
            {...props}
          />
        );

      case "file":
        // value is expected to be File | null
        return (
          <FileUploadField
            label={label}
            name={field}
            fileValue={value}
            onFileChange={(f: File | null) => handleChange(f)}
          />
        );
     

      case "multi-select":
        return (
          <div className={cn("space-y-2", className)}>
            {/* Show selected items inline (scrollable on large screens), wrap on mobile */}
            {value?.length > 0 && (
              <div className="flex flex-wrap md:flex-nowrap items-center gap-1   whitespace-nowrap text-xs text-slate-600 py-1">
                {value
                  .map((val: string) => optionsArray.find((opt) => opt.value === val)?.label)
                  .filter(Boolean)
                  .map((label: string, idx: number) => (
                    <span key={idx} className="bg-slate-100 px-2 py-1 rounded mb-1 md:mb-0">
                      {label}
                    </span>
                  ))}
              </div>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="truncate">
                    {value?.length > 0 ? `${value.length} selected` : "Select options..."}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search options..." />
                  <CommandList>
                    <CommandEmpty>No options found.</CommandEmpty>
                    <CommandGroup>
                      {optionsArray.map((option) => (
                        <CommandItem
                          key={option.value}
                          onSelect={() => {
                            const newValue = value?.includes(option.value)
                              ? value.filter((v: string) => v !== option.value)
                              : [...(value || []), option.value];
                            handleChange(newValue);
                          }}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            checked={value?.includes(option.value)}
                            className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          />
                          <span>{option.label}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        );

      default:
        return (
          <Input
            name={field}
            type={inputType}
            placeholder={placeholder}
            className={cn(className, error && "border-red-500")}
            disabled={disabled}
            value={value ?? ""}
            maxLength={maxLength}
            onChange={handleChange}
            required={require}
            {...props}
          />
        );
    }
  };

  // If `show` prop is false, don't render (keeps your original `show` default behavior)
  if (show === false) return null;

  return (
    <div className="space-y-2">
      <Label
        htmlFor={field}
        className={cn(
          "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
          require && "after:content-['*'] after:text-red-500 after:ml-1"
        )}
      >
        {label}
      </Label>

      <div className="space-y-1">
        {renderInput()}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
