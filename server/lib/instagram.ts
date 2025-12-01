import axios from "axios";
import type { Request } from "express";

const INSTAGRAM_BASE_URL = process.env.INSTAGRAM_BASE_URL || "https://graph.facebook.com/v19.0";
const INSTAGRAM_TOKEN_URL = process.env.INSTAGRAM_TOKEN_URL || "https://api.instagram.com/oauth/access_token";
const FACEBOOK_GRAPH_URL = "https://graph.facebook.com/v21.0";
const INSTAGRAM_GRAPH_URL = "https://graph.instagram.com/v21.0";

export async function lookupInstagramUserId(username: string): Promise<string | null> {
  const cleanUsername = username.replace('@', '').trim();
  
  if (!cleanUsername) {
    console.log("Empty username provided");
    return null;
  }
  
  console.log(`Looking up Instagram User ID for: @${cleanUsername}`);
  
  try {
    const url = `https://www.instagram.com/${cleanUsername}/?__a=1&__d=1`;
    
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Connection": "keep-alive",
      },
      timeout: 10000,
    });
    
    const text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    
    const match = text.match(/"profile_id":"(\d+)"/);
    
    if (match && match[1]) {
      console.log(`Found User ID for @${cleanUsername}: ${match[1]}`);
      return match[1];
    }
    
    const userIdMatch = text.match(/"user_id":"(\d+)"/);
    if (userIdMatch && userIdMatch[1]) {
      console.log(`Found User ID (alt) for @${cleanUsername}: ${userIdMatch[1]}`);
      return userIdMatch[1];
    }
    
    const pkMatch = text.match(/"pk":"(\d+)"/);
    if (pkMatch && pkMatch[1]) {
      console.log(`Found User ID (pk) for @${cleanUsername}: ${pkMatch[1]}`);
      return pkMatch[1];
    }
    
    const idMatch = text.match(/"id":"(\d+)"/);
    if (idMatch && idMatch[1]) {
      console.log(`Found User ID (id) for @${cleanUsername}: ${idMatch[1]}`);
      return idMatch[1];
    }
    
    console.log(`User ID not found in response for @${cleanUsername}`);
    return null;
  } catch (error: any) {
    console.error(`Error looking up User ID for @${cleanUsername}:`, error?.message);
    
    if (error?.response?.status === 404) {
      console.log(`User @${cleanUsername} not found (404)`);
    } else if (error?.response?.status === 429) {
      console.log(`Rate limited when looking up @${cleanUsername}`);
    }
    
    return null;
  }
}

export function getFacebookCallbackUrl(req: Request): string {
  if (process.env.NEXT_PUBLIC_HOST_URL) {
    return `${process.env.NEXT_PUBLIC_HOST_URL}/api/facebook/oauth/callback`;
  }
  const host = req.get("host") || "localhost:5000";
  const protocol = req.protocol === "https" || host.includes(".replit.dev") || host.includes(".replit.app") ? "https" : req.protocol;
  return `${protocol}://${host}/api/facebook/oauth/callback`;
}

export async function exchangeFacebookCodeForToken(code: string, redirectUri: string) {
  const response = await axios.get(`${FACEBOOK_GRAPH_URL}/oauth/access_token`, {
    params: {
      client_id: process.env.FACEBOOK_APP_ID || process.env.INSTAGRAM_CLIENT_ID,
      client_secret: process.env.FACEBOOK_APP_SECRET || process.env.INSTAGRAM_CLIENT_SECRET,
      redirect_uri: redirectUri,
      code: code
    }
  });
  return response.data;
}

export async function getFacebookLongLivedToken(shortLivedToken: string) {
  const response = await axios.get(`${FACEBOOK_GRAPH_URL}/oauth/access_token`, {
    params: {
      grant_type: "fb_exchange_token",
      client_id: process.env.FACEBOOK_APP_ID || process.env.INSTAGRAM_CLIENT_ID,
      client_secret: process.env.FACEBOOK_APP_SECRET || process.env.INSTAGRAM_CLIENT_SECRET,
      fb_exchange_token: shortLivedToken
    }
  });
  return response.data;
}

export async function getFacebookPages(accessToken: string) {
  const response = await axios.get(`${FACEBOOK_GRAPH_URL}/me/accounts`, {
    params: {
      access_token: accessToken,
      fields: "id,name,access_token,instagram_business_account"
    }
  });
  return response.data.data || [];
}

export async function getInstagramBusinessAccount(pageAccessToken: string, pageId: string) {
  try {
    const response = await axios.get(`${FACEBOOK_GRAPH_URL}/${pageId}`, {
      params: {
        access_token: pageAccessToken,
        fields: "instagram_business_account{id,username}"
      }
    });
    return response.data.instagram_business_account;
  } catch (error: any) {
    console.error("Error getting Instagram business account:", error?.response?.data || error?.message);
    return null;
  }
}

export function getInstagramCallbackUrl(req: Request): string {
  if (process.env.NEXT_PUBLIC_HOST_URL) {
    return `${process.env.NEXT_PUBLIC_HOST_URL}/api/instagram/oauth/callback`;
  }
  const host = req.get("host") || "localhost:5000";
  const protocol = req.protocol === "https" || host.includes(".replit.dev") || host.includes(".replit.app") ? "https" : req.protocol;
  return `${protocol}://${host}/api/instagram/oauth/callback`;
}

export interface InstagramTokenResponse {
  access_token: string;
  user_id: number;
  expires_in?: number;
}

export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<InstagramTokenResponse> {
  const params = new URLSearchParams();
  params.append("client_id", process.env.INSTAGRAM_CLIENT_ID || "");
  params.append("client_secret", process.env.INSTAGRAM_CLIENT_SECRET || "");
  params.append("grant_type", "authorization_code");
  params.append("redirect_uri", redirectUri);
  params.append("code", code);

  const response = await axios.post(INSTAGRAM_TOKEN_URL, params, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    }
  });

  return response.data;
}

export async function getInstagramUserInfo(accessToken: string, userId: string) {
  // Try Instagram Graph API endpoint first (for Business accounts)
  try {
    const response = await axios.get(`https://graph.instagram.com/me`, {
      params: {
        fields: "id,username,account_type",
        access_token: accessToken
      }
    });
    return response.data;
  } catch (error: any) {
    console.log("Instagram /me endpoint failed, trying user ID endpoint:", error?.message);
    // Fall back to user ID endpoint
    try {
      const response = await axios.get(`https://graph.instagram.com/${userId}`, {
        params: {
          fields: "id,username,account_type",
          access_token: accessToken
        }
      });
      return response.data;
    } catch (error2: any) {
      console.log("Instagram user ID endpoint failed, returning basic info");
      // If both fail, return basic info from the token exchange
      return {
        id: userId,
        username: `instagram_user_${userId}`,
        account_type: "BUSINESS"
      };
    }
  }
}

export async function getLongLivedToken(shortLivedToken: string) {
  try {
    console.log("Attempting to exchange for long-lived token...");
    
    // For Instagram Business API, use Facebook Graph API endpoint for token exchange
    // Instagram Basic Display API is deprecated as of December 2024
    const response = await axios.get(`${FACEBOOK_GRAPH_URL}/oauth/access_token`, {
      params: {
        grant_type: "fb_exchange_token",
        client_id: process.env.INSTAGRAM_CLIENT_ID,
        client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
        fb_exchange_token: shortLivedToken
      }
    });
    
    console.log("Long-lived token obtained via Facebook Graph API, expires in:", response.data.expires_in, "seconds");
    return response.data;
  } catch (error: any) {
    console.error("Failed to get long-lived token via Facebook Graph API:", error?.response?.data || error?.message);
    
    // Fallback: try Instagram Graph API endpoint (in case short-lived token is from older flow)
    try {
      console.log("Trying Instagram Graph API endpoint as fallback...");
      const response = await axios.get(`https://graph.instagram.com/access_token`, {
        params: {
          grant_type: "ig_exchange_token",
          client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
          access_token: shortLivedToken
        }
      });
      console.log("Long-lived token obtained via Instagram Graph API, expires in:", response.data.expires_in, "seconds");
      return response.data;
    } catch (fallbackError: any) {
      console.error("Instagram Graph API fallback also failed:", fallbackError?.response?.data || fallbackError?.message);
      throw error; // Throw original error
    }
  }
}

export async function refreshLongLivedToken(currentToken: string) {
  try {
    console.log("Refreshing long-lived token...");
    const response = await axios.get(`https://graph.instagram.com/refresh_access_token`, {
      params: {
        grant_type: "ig_refresh_token",
        access_token: currentToken
      }
    });
    console.log("Token refreshed, new expiry:", response.data.expires_in, "seconds");
    return response.data;
  } catch (error: any) {
    console.error("Failed to refresh token:", error?.response?.data || error?.message);
    throw error;
  }
}

export interface DMButton {
  type: "web_url";
  url: string;
  title: string;
}

export interface DMLink {
  label?: string;
  url: string;
  isButton?: boolean;
}

export interface SendDMOptions {
  accessToken: string;
  recipientId: string;
  message: string;
  buttons?: DMButton[];
  igBusinessAccountId?: string;
  pageAccessToken?: string;
}

export async function sendDirectMessage(
  accessTokenOrOptions: string | SendDMOptions, 
  recipientId?: string, 
  message?: string, 
  buttons?: DMButton[]
) {
  let options: SendDMOptions;
  
  if (typeof accessTokenOrOptions === 'string') {
    options = {
      accessToken: accessTokenOrOptions,
      recipientId: recipientId!,
      message: message!,
      buttons
    };
  } else {
    options = accessTokenOrOptions;
  }

  const { accessToken, igBusinessAccountId, pageAccessToken } = options;
  const finalRecipientId = options.recipientId;
  const finalMessage = options.message;
  const finalButtons = options.buttons;
  
  const tokenToUse = pageAccessToken || accessToken;
  
  try {
    console.log("Sending Instagram DM to:", finalRecipientId);
    console.log("Message:", finalMessage);
    console.log("Buttons:", finalButtons);
    console.log("Using IG Business Account ID:", igBusinessAccountId || "not provided (using /me)");
    console.log("Using page token:", pageAccessToken ? "yes" : "no (using access token)");
    
    let messagePayload: any;
    
    if (finalButtons && finalButtons.length > 0) {
      messagePayload = {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: [{
              title: finalMessage.substring(0, 80),
              subtitle: finalMessage.length > 80 ? finalMessage.substring(80, 160) : undefined,
              buttons: finalButtons.slice(0, 3).map(btn => ({
                type: "web_url",
                url: btn.url,
                title: btn.title.substring(0, 20)
              }))
            }]
          }
        }
      };
    } else {
      messagePayload = { text: finalMessage };
    }
    
    const endpoint = igBusinessAccountId 
      ? `${FACEBOOK_GRAPH_URL}/${igBusinessAccountId}/messages`
      : `${INSTAGRAM_GRAPH_URL}/me/messages`;
    
    console.log("Using endpoint:", endpoint);
    
    const response = await axios.post(endpoint, {
      recipient: { id: finalRecipientId },
      message: messagePayload
    }, {
      headers: {
        Authorization: `Bearer ${tokenToUse}`,
        "Content-Type": "application/json"
      }
    });

    console.log("DM sent successfully:", response.data);
    return response.data;
  } catch (error: any) {
    const errorData = error?.response?.data?.error;
    console.error("Error sending DM:", errorData || error?.message);
    console.error("Status:", error?.response?.status);
    console.error("Recipient ID:", finalRecipientId);
    console.error("Full error response:", JSON.stringify(error?.response?.data, null, 2));
    
    if (igBusinessAccountId && !pageAccessToken) {
      console.log("Retrying with Instagram Graph API endpoint...");
      try {
        const fallbackResponse = await axios.post(`${INSTAGRAM_GRAPH_URL}/me/messages`, {
          recipient: { id: finalRecipientId },
          message: { text: finalMessage }
        }, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          }
        });
        console.log("Fallback DM sent successfully:", fallbackResponse.data);
        return fallbackResponse.data;
      } catch (fallbackError: any) {
        console.error("Instagram Graph API fallback also failed:", fallbackError?.response?.data?.error || fallbackError?.message);
      }
    }
    
    if (finalButtons && finalButtons.length > 0) {
      console.log("Retrying without buttons (text only)...");
      try {
        const textOnlyEndpoint = igBusinessAccountId 
          ? `${FACEBOOK_GRAPH_URL}/${igBusinessAccountId}/messages`
          : `${INSTAGRAM_GRAPH_URL}/me/messages`;
          
        const textOnlyResponse = await axios.post(textOnlyEndpoint, {
          recipient: { id: finalRecipientId },
          message: { text: finalMessage }
        }, {
          headers: {
            Authorization: `Bearer ${tokenToUse}`,
            "Content-Type": "application/json"
          }
        });
        console.log("Text-only DM sent successfully:", textOnlyResponse.data);
        return textOnlyResponse.data;
      } catch (textError: any) {
        console.error("Text-only fallback also failed:", textError?.response?.data?.error || textError?.message);
      }
    }
    
    throw error;
  }
}

export interface SendDMWithButtonsOptions {
  accessToken: string;
  recipientId: string;
  message: string;
  links?: DMLink[];
  igBusinessAccountId?: string;
  pageAccessToken?: string;
}

export async function sendDirectMessageWithButtons(
  accessTokenOrOptions: string | SendDMWithButtonsOptions, 
  recipientId?: string, 
  message?: string, 
  links?: DMLink[]
) {
  let options: SendDMWithButtonsOptions;
  
  if (typeof accessTokenOrOptions === 'string') {
    options = {
      accessToken: accessTokenOrOptions,
      recipientId: recipientId!,
      message: message!,
      links
    };
  } else {
    options = accessTokenOrOptions;
  }
  
  const buttons: DMButton[] = [];
  
  if (options.links && options.links.length > 0) {
    for (const link of options.links) {
      if (link.isButton) {
        buttons.push({
          type: "web_url",
          url: link.url,
          title: link.label || "Open link"
        });
      }
    }
  }
  
  if (buttons.length > 0) {
    return sendDirectMessage({
      accessToken: options.accessToken,
      recipientId: options.recipientId,
      message: options.message,
      buttons,
      igBusinessAccountId: options.igBusinessAccountId,
      pageAccessToken: options.pageAccessToken
    });
  } else {
    let fullMessage = options.message;
    if (options.links && options.links.length > 0) {
      fullMessage += "\n\n";
      for (const link of options.links) {
        if (link.label) {
          fullMessage += `${link.label}\n${link.url}\n\n`;
        } else {
          fullMessage += `${link.url}\n\n`;
        }
      }
    }
    return sendDirectMessage({
      accessToken: options.accessToken,
      recipientId: options.recipientId,
      message: fullMessage.trim(),
      igBusinessAccountId: options.igBusinessAccountId,
      pageAccessToken: options.pageAccessToken
    });
  }
}

export async function getUserMedia(accessToken: string, userId: string) {
  try {
    const response = await axios.get(`https://graph.instagram.com/${userId}/media`, {
      params: {
        fields: "id,caption,media_type,permalink,thumbnail_url,timestamp",
        access_token: accessToken,
        limit: 50
      }
    });
    return response.data.data || [];
  } catch (error: any) {
    console.error("Error fetching Instagram media:", error?.message);
    return [];
  }
}

export async function sendPrivateReply(accessToken: string, igBusinessAccountId: string, commentId: string, message: string) {
  try {
    console.log("Attempting to send private reply to comment:", commentId);
    console.log("Message:", message);
    console.log("Using IG Business Account ID:", igBusinessAccountId);
    
    // Try Instagram Graph API first (works with Instagram access token)
    try {
      console.log("Trying Instagram Graph API endpoint...");
      const response = await axios.post(
        `${INSTAGRAM_GRAPH_URL}/me/messages`,
        {
          recipient: JSON.stringify({ comment_id: commentId }),
          message: JSON.stringify({ text: message }),
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      console.log("Private reply sent successfully via Instagram Graph API:", response.data);
      return response.data;
    } catch (igError: any) {
      console.log("Instagram Graph API failed:", igError?.response?.data?.error?.message || igError?.message);
      
      // Fallback to Facebook Graph API
      console.log("Trying Facebook Graph API endpoint...");
      const response = await axios.post(
        `${FACEBOOK_GRAPH_URL}/${igBusinessAccountId}/messages`,
        {
          recipient: {
            comment_id: commentId,
          },
          message: {
            text: message,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      console.log("Private reply sent successfully via Facebook Graph API:", response.data);
      return response.data;
    }
  } catch (error: any) {
    const errorData = error?.response?.data?.error;
    console.error("Error sending private reply:", errorData || error?.message);
    console.error("Status:", error?.response?.status);
    console.error("Comment ID:", commentId);
    
    // Provide helpful error messages
    if (errorData?.code === 100) {
      console.error("This error usually means:");
      console.error("1. Instagram account needs to be Business/Creator type");
      console.error("2. Instagram must be connected to a Facebook Page");
      console.error("3. Messaging API needs to be enabled in Meta Developer Console");
    }
    
    throw error;
  }
}

export async function getCommentDetails(accessToken: string, commentId: string) {
  try {
    const response = await axios.get(`${INSTAGRAM_BASE_URL}/${commentId}`, {
      params: {
        fields: "id,text,username,from,media",
        access_token: accessToken
      }
    });
    return response.data;
  } catch (error: any) {
    console.error("Error fetching comment details:", error?.message);
    return null;
  }
}

export async function replyToComment(accessToken: string, commentId: string, message: string) {
  try {
    console.log("Replying to comment:", commentId);
    console.log("Reply message:", message);
    
    const response = await axios.post(
      `${INSTAGRAM_GRAPH_URL}/${commentId}/replies`,
      {
        message: message
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );
    
    console.log("Comment reply sent successfully:", response.data);
    return response.data;
  } catch (error: any) {
    const errorData = error?.response?.data?.error;
    console.error("Error replying to comment:", errorData || error?.message);
    console.error("Status:", error?.response?.status);
    
    if (error?.response?.status === 400) {
      console.log("Trying Facebook Graph API endpoint as fallback...");
      try {
        const fbResponse = await axios.post(
          `${FACEBOOK_GRAPH_URL}/${commentId}/replies`,
          {
            message: message
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json"
            }
          }
        );
        console.log("Comment reply sent via Facebook API:", fbResponse.data);
        return fbResponse.data;
      } catch (fbError: any) {
        console.error("Facebook API fallback also failed:", fbError?.response?.data || fbError?.message);
        throw fbError;
      }
    }
    throw error;
  }
}
