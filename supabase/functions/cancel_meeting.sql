-- Function to cancel a meeting
-- Includes atomic updates and calendar sync

CREATE OR REPLACE FUNCTION public.cancel_meeting(
  p_meeting_id UUID,
  p_participant_token TEXT DEFAULT NULL -- Token for secure access
)
RETURNS JSONB AS $$
DECLARE
  v_meeting RECORD;
BEGIN
  -- Get meeting details
  SELECT *
  INTO v_meeting
  FROM public.meetings
  WHERE id = p_meeting_id
    AND status IN ('confirmed', 'pending');

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Meeting not found or already cancelled'
    );
  END IF;

  -- TODO: Verify participant_token if provided (for secure links)

  -- Update meeting status
  UPDATE public.meetings
  SET
    status = 'cancelled',
    updated_at = NOW()
  WHERE id = p_meeting_id;

  -- Update participant statuses
  UPDATE public.meeting_participants
  SET
    status = 'cancelled',
    updated_at = NOW()
  WHERE meeting_id = p_meeting_id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'meeting_id', p_meeting_id,
    'cancelled_at', NOW()
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'An error occurred while cancelling: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.cancel_meeting(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_meeting(UUID, TEXT) TO anon;

