import unittest
from unittest.mock import patch, MagicMock
from app.integrations.fcm import FCMPushProvider


class TestFCMPushProvider(unittest.TestCase):
    def test_mock_mode_when_no_credentials(self):
        provider = FCMPushProvider(credentials_path_or_json="")
        provider._parsed_creds = None
        res = provider.send(
            token="fcm_fake_token_12345",
            title="नमस्ते जी!",
            body="आज अपना हाल-चाल बताना न भूलें।",
            data={"kind": "daily_wellbeing", "senior_id": "S0042"},
        )
        self.assertTrue(res)

    def test_mock_mode_invalid_token_rejected(self):
        provider = FCMPushProvider()
        res = provider.send(
            token="invalid_fcm_token_123",
            title="नमस्ते जी!",
            body="आज अपना हाल-चाल बताना न भूलें।",
            data={"kind": "daily_wellbeing"},
        )
        self.assertFalse(res)

    def test_live_configured_unregistered_token_returns_false(self):
        with patch("httpx.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value.__enter__.return_value = mock_client

            # Return 404 UNREGISTERED response
            mock_resp = MagicMock()
            mock_resp.status_code = 404
            mock_resp.text = '{"error":{"code":404,"status":"UNREGISTERED","message":"Requested entity was not found."}}'
            mock_client.post.return_value = mock_resp

            provider = FCMPushProvider()
            provider._parsed_creds = {
                "project_id": "test-project",
                "client_email": "test@test-project.iam.gserviceaccount.com",
                "private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC3\\n-----END PRIVATE KEY-----\\n",
            }
            provider._access_token = "mock_token"
            provider._token_expires_at = 9999999999.0

            res = provider.send(
                token="stale_unregistered_token",
                title="नमस्ते जी!",
                body="आज अपना हाल-चाल बताना न भूलें।",
                data={"kind": "daily_wellbeing"},
            )
            # Should return False when token is unregistered
            self.assertFalse(res)


if __name__ == "__main__":
    unittest.main()
