import { type Response } from "express";

import type { AuthenticatedRequest } from "../middlewares/authenticate";

import { analyzeBusinessLeaks } from "../services/leakDetection.service";

import { generateAIExplanation } from "../services/aiExplanation.service";
import OpenAI from "openai";

export const getAIRecommendations = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user;

    if (!user || !user.businessId) {
      res.status(403).json({
        success: false,
        message: "No business is associated with this account.",
      });
      return;
    }

    // Step 1: Detect alerts from MongoDB data
    const analysis = await analyzeBusinessLeaks(user.businessId, user.id);

    const activeAlerts = analysis.alerts;

    // Step 2: Return early if no alerts exist
    if (activeAlerts.length === 0) {
      res.status(200).json({
        success: true,
        period: {
          startDate: analysis.startDate,
          endDate: analysis.endDate,
        },
        analyzedAlertsCount: 0,
        alerts: [],
        aiRecommendation:
          "No business leaks were detected based on the current analysis.",
      });
      return;
    }

    // Step 3: Generate AI recommendations from detected alerts
    const aiSummary = await generateAIExplanation(activeAlerts);

    // Step 4: Return alerts and AI recommendations
    res.status(200).json({
      success: true,

      period: {
        startDate: analysis.startDate,
        endDate: analysis.endDate,
      },

      analyzedAlertsCount: activeAlerts.length,

      alerts: activeAlerts,

      aiRecommendation: aiSummary,
    });
  } catch (error: unknown) {
    console.error("AI recommendation error:", error);

    if (error instanceof OpenAI.APIError) {
      if (error.status === 429 && error.code === "insufficient_quota") {
        res.status(503).json({
          success: false,
          message:
            "AI service is temporarily unavailable due to insufficient API credits.",
          code: "AI_CREDITS_EXHAUSTED",
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      message: "Failed to generate AI recommendations.",
    });
  }
};
