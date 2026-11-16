// Chrome's built-in Gemini Nano (Prompt API) is newer than @types/chrome, so declare the bits we use.
declare const LanguageModel:
  | {
      availability(): Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'>
      create(opts?: object): Promise<{ prompt(text: string): Promise<string>; destroy(): void }>
    }
  | undefined
