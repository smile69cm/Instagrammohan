import axios from "axios";
import type { Request } from "express";

const INSTAGRAM_BASE_URL = process.env.INSTAGRAM_BASE_URL || "https://graph.facebook.com/v19.0";
const INSTAGRAM_TOKEN_URL = process.env.INSTAGRAM_TOKEN_URL || "https://api.instagram.com/oauth/access_token";
const FACEBOOK_GRAPH_URL = "https://graph.facebook.com/v21.0";
const INSTAGRAM_GRAPH_URL = "https://graph.instagram.com/v21.0";

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

export async function sendDirectMessage(accessToken: string, recipientId: string, message: string) {
  try {
    console.log("Sending Instagram DM to:", recipientId);
    console.log("Message:", message);
    
    const response = await axios.post(`${INSTAGRAM_GRAPH_URL}/me/messages`, {
      recipient: JSON.stringify({ id: recipientId }),
      message: JSON.stringify({ text: message })
    }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });

    console.log("DM sent successfully:", response.data);
    return response.data;
  } catch (error: any) {
    const errorData = error?.response?.data?.error;
    console.error("Error sending DM:", errorData || error?.message);
    console.error("Status:", error?.response?.status);
    console.error("Recipient ID:", recipientId);
    throw error;
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
