// ============================================================================
// SDK TYPES
// ============================================================================

/**
 * Message format for AI conversations
 */
export interface Message {
    role: 'user' | 'system' | 'assistant' | 'function' | 'tool';
    content: string;
    name?: string;
  }
  
  /**
   * AI models for text generation
   */
  export type TextModel = 
    | 'Best'
    | 'Fast'
    | string; // Allows for provider-specific models
  
  /**
   * AI models for image generation
   */
  export type ImageModel = 
    | 'Best'
    | 'Fast'
    | string; // Allows for provider-specific models
  
  /**
   * AI models for video generation
   */
  export type VideoModel = 
    | 'Best'
    | 'Fast'
    | string; // Allows for provider-specific models
  
  /**
   * AI models for audio generation
   */
  export type AudioModel = 
    | 'Best'
    | 'Fast'
    | string; // Allows for provider-specific models
  
  /**
   * AI models for 3D object generation
   */
  export type ObjectModel3D = 
    | 'Best'
    | 'Fast'
    | string; // Allows for provider-specific models
  
  /**
   * Provider-specific options for AI requests
   */
  export type ProviderOptions = Record<string, any>;
  
  /**
   * Core tool definition for AI assistants
   */
  export interface CoreTool {
    type: string;
    function: {
      name: string;
      description: string;
      parameters: Record<string, any>;
    };
  }
  
  /**
   * Response for 3D object generation
   */
  export interface Object3DResponse {
    object?: string;
    filepath?: string;
  }
  
  /**
   * Credits available in the wallet
   */
  export interface WalletCredits {
    availableCredits: number;
    usedCredits: number;
  }
  
  /**
   * Payload for adding credits
   */
  export interface AddCreditsPayload {
    amount?: number;
  }
  
  /**
   * Response from adding credits
   */
  export interface AddCreditsResponse {
    success: boolean;
    transaction?: {
      id: string;
      amount: number;
      timestamp: string;
    };
  }
  
  /**
   * Text generation payload
   */
  export type TextPayload = {
    model?: TextModel;
    system?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    tools?: Record<string, CoreTool>;
    providerOptions?: ProviderOptions;
    headers?: Record<string, string>;
  } & ({
    messages: Message[];
  } | {
    prompt: string;
  });
  
  /**
   * Object generation payload
   */
  export type ObjectPayload = {
    schema: {
      type: "object";
      properties: Record<string, any>;
    };
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    streamType?: "partial_object" | "text_stream";
    providerOptions?: ProviderOptions;
  } & ({
    messages: Message[];
  } | {
    prompt: string;
  });
  
  /**
   * Image generation payload
   */
  export type ImagePayload = {
    model?: ImageModel;
    prompt?: string;
    image?: string;
    n?: number;
    size?: `${number}x${number}`;
    aspectRatio?: `${number}:${number}`;
    providerOptions?: ProviderOptions;
    headers?: Record<string, string>;
    seed?: number;
  };
  
  /**
   * Video generation payload
   */
  export type VideoPayload = {
    model?: VideoModel;
    prompt?: string;
    image?: string;
    video?: string;
    providerOptions?: ProviderOptions;
    headers?: Record<string, string>;
  };
  
  /**
   * Audio generation payload
   */
  export type AudioPayload = {
    model?: AudioModel;
    prompt?: string;
    audio?: string;
    providerOptions?: ProviderOptions;
    headers?: Record<string, string>;
  };
  
  /**
   * 3D object generation payload
   */
  export type Object3DPayload = {
    model?: ObjectModel3D;
    prompt?: string;
    image?: string;
    providerOptions?: ProviderOptions;
    headers?: Record<string, string>;
    seed?: number;
  };
  
  /**
   * AI interface
   */
  export interface AIInterface {
    /**
     * Generate text using AI
     */
    generateText(input: TextPayload): Promise<{ text: string; filepath: string }>;
    
    /**
     * Stream text generation results
     */
    streamText(input: TextPayload): Promise<AsyncIterableIterator<{ text: string }>>;
    
    /**
     * Generate a structured object using AI
     */
    generateObject<T = any>(input: ObjectPayload): Promise<{ object: T; filepath: string }>;
    
    /**
     * Stream object generation results
     */
    streamObject<T = any>(input: ObjectPayload): Promise<AsyncIterableIterator<Partial<T>>>;
    
    /**
     * Generate images using AI
     */
    generateImage(input: ImagePayload): Promise<{ images: string[]; filepath: string }>;
    
    /**
     * Generate video using AI
     */
    generateVideo(input: VideoPayload): Promise<{ video?: string; filepath: string }>;
    
    /**
     * Generate audio using AI
     */
    generateAudio(input: AudioPayload): Promise<{ audios: string[]; filepath: string[] }>;
    
    /**
     * Generate 3D objects using AI
     */
    generate3DObject(input: Object3DPayload): Promise<Object3DResponse>;
    
    /**
     * Get available credits in the wallet
     */
    getCredits(): Promise<WalletCredits>;
    
    /**
     * Show UI to add credits to wallet
     */
    showAddCreditsToWallet(input: AddCreditsPayload): Promise<AddCreditsResponse>;
  }
  
  /**
   * WebdrawSDK main interface
   */
  export interface WebdrawSDK {
    /**
     * Filesystem interface for working with files
     */
    fs: FileSystemInterface;
    
    /**
     * AI interface for generating content
     */
    ai: AIInterface;
    
    /**
     * Check if the SDK is ready to use
     */
    isReady(): boolean;
    
    /**
     * Get a promise that resolves when the SDK is ready to use
     */
    ready(): Promise<boolean>;
    
    /**
     * Get current user information
     */
    getUser(): Promise<{ username: string } | null>;
    
    /**
     * Redirect to login page
     */
    redirectToLogin(options?: { appReturnUrl?: string }): Promise<void>;
    
    /**
     * Simple hello function for testing connection
     */
    hello(): Promise<string>;
    
    /**
     * Create variations of an image
     * @deprecated Use ai.* methods instead
     */
    imageVariation?(...args: any[]): Promise<any>;
    
    /**
     * Upscale an image
     * @deprecated Use ai.* methods instead
     */
    upscaleImage?(...args: any[]): Promise<any>;
    
    /**
     * Remove background from an image
     * @deprecated Use ai.* methods instead
     */
    removeBackground?(...args: any[]): Promise<any>;
  }
  
  /**
   * File system interface
   */
  export interface FileSystemInterface {
    list(path: string): Promise<string[]>;
    readFile(options: FileSystemOptions): Promise<string>;
    read(filepath: string, options?: any): Promise<string>;
    writeFile(options: FileSystemOptions): Promise<void>;
    write(filepath: string, text: string, options?: any): Promise<void>;
    delete(options: FileSystemOptions): Promise<void>;
    remove(filepath: string): Promise<void>;
    mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
    
    // Additional methods used in implementation
    chmod(filepath: string, mode: number): Promise<void>;
    exists(filepath: string): Promise<boolean>;
  }
  
  // ============================================================================
  // PARAMETER TYPES
  // ============================================================================
  
  /**
   * File system options
   */
  export interface FileSystemOptions {
    path: string;
    content?: string;
    encoding?: string;
  }
  
  /**
   * @deprecated Use TextPayload instead
   */
  export interface GenerateTextParams {
    prompt: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  }
  
  /**
   * @deprecated Use ImagePayload instead
   */
  export interface GenerateImageParams {
    prompt: string;
    model?: string;
    width?: number;
    height?: number;
    negativePrompt?: string;
  }
  
  /**
   * @deprecated Use AudioPayload instead
   */
  export interface GenerateAudioParams {
    prompt: string;
    model?: string;
    voice?: string;
    speed?: number;
  }
  
  /**
   * @deprecated Use VideoPayload instead
   */
  export interface GenerateVideoParams {
    prompt: string;
    model?: string;
    duration?: number;
    width?: number;
    height?: number;
    fps?: number;
  }
  
  /**
   * @deprecated Use ObjectPayload instead
   */
  export interface GenerateObjectParams {
    prompt: string;
    schema: any;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  }
  
  // ============================================================================
  // USER TYPES
  // ============================================================================
  
  /**
   * Webdraw user information
   */
  export interface WebdrawUser {
    username: string;
  }
  
  /**
   * AI generate options
   */
  export interface AIGenerateOptions {
    prompt: string;
    model?: string;
    maxTokens?: number;
  }
  